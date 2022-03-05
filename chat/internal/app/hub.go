package app

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"time"

	"encoding/json"

	"firebase.google.com/go/v4/auth"
	"github.com/diadara/sandesham/chat/internal/db"
	"github.com/go-redis/redis/v8"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Hub struct {
	// Registered clients.
	clients map[*Client]bool

	// Inbound messages from the clients.
	broadcast chan []byte

	// Register requests from the clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	rc *redis.Client

	mr             *db.MessageRepository
	ur             *db.UserRepository
	messageRouter  *MessageRouter
	membershipRepo *db.MembershipRepository
}

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	hub *Hub

	token *auth.Token
	user  *db.User

	// The websocket connection.
	conn *websocket.Conn

	// Buffered channel of outbound messages.
	send chan []byte
}

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 512
)

var (
	newline = []byte{'\n'}
	space   = []byte{' '}
)

// readPump pumps messages from the websocket connection to the hub.
//
// The application runs readPump in a per-connection goroutine. The application
// ensures that there is at most one reader on a connection by executing all
// reads from this goroutine.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		message = bytes.TrimSpace(bytes.Replace(message, newline, space, -1))

		var msg db.Message
		msg.Type = 0
		json.Unmarshal(message, &msg)

		msg.From = *c.user
		fmt.Println("message", msg, c.user)

		//Save to DB
		//
		ctx := context.TODO()
		//c.hub.broadcast <- message
		// Push to appropriate redis topic
		//

		result, err := c.hub.mr.SaveMessage(ctx, msg)
		fmt.Println(result, err)
		msg.Id = result.InsertedID.(primitive.ObjectID).Hex()
		jsonMsg, err := json.Marshal(msg)
		//c.hub.rc.Publish(ctx, "chat", string(jsonMsg))
		fmt.Println("publishing message into redis", string(jsonMsg))
		c.hub.messageRouter.RouteMessage(ctx, &msg)
	}
}

// writePump pumps messages from the hub to the websocket connection.
//
// A goroutine running writePump is started for each connection. The
// application ensures that there is at most one writer to a connection by
// executing all writes from this goroutine.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	// listens to the redis and pumps the messages
	ctx := context.TODO()
	// subscribe to the userid
	//
	memberships, err := c.hub.membershipRepo.GetCommunities(ctx, c.user)
	var communityIds []string
	if err != nil {
		for _, membership := range memberships {
			communityIds = append(communityIds, membership.Community.ID.Hex())
		}
	}
	communityIds = append(communityIds, c.user.ID.Hex())
	pubsub := c.hub.rc.Subscribe(ctx, communityIds...)
	fmt.Println("sub to chat")
	ch := pubsub.Channel()
	fmt.Println("channel created to listen")
	for {
		select {
		case message := <-ch:
			fmt.Println("recieved message")
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			fmt.Println("recivied message from redis")
			w.Write([]byte(message.Payload))

			// Add queued chat messages to the current websocket message.
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write(newline)
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
func NewHub(rc *redis.Client, mr *db.MessageRepository, ur *db.UserRepository, memberRepo *db.MembershipRepository, messageRouter *MessageRouter) *Hub {
	return &Hub{
		broadcast:      make(chan []byte),
		register:       make(chan *Client),
		unregister:     make(chan *Client),
		clients:        make(map[*Client]bool),
		rc:             rc,
		mr:             mr,
		ur:             ur,
		membershipRepo: memberRepo,
		messageRouter:  messageRouter,
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}
