package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/diadara/sandesham/chat/internal/db"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func NewApiRouter(mc *MessageController) *mux.Router {
	router := mux.NewRouter()

	router.HandleFunc("/api/messages", mc.MessageList).Methods("GET")

	router.HandleFunc("/api/messages", func(rw http.ResponseWriter, r *http.Request) {
		rw.Header().Set("Content-Type", "application/json")

		json.NewEncoder(rw).Encode(map[string]string{"data": "Hello POST from Mux & mongoDB"})
	}).Methods("POST")

	return router
}
func serveHome(w http.ResponseWriter, r *http.Request) {
	log.Println(r.URL)
	if r.URL.Path != "/" {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	http.ServeFile(w, r, "home.html")
}

// serveWs handles websocket requests from the peer.
func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	token := params["token"]
	fmt.Println(token)
	// TODO impliment firebase
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}
	client.hub.register <- client

	// Allow collection of memory referenced by the caller by doing all work in
	// new goroutines.
	go client.writePump()
	go client.readPump()
}

type MessageController struct {
	mr *db.MessageRepository
}

func NewMessageController(mr *db.MessageRepository) *MessageController {
	mc := &MessageController{mr: mr}
	return mc
}

func (mc *MessageController) MessageList(rw http.ResponseWriter, r *http.Request) {

	var ctx = context.Background()
	rw.Header().Set("Content-Type", "application/json")
	fmt.Println("in message list controller")
	result, err := mc.mr.GetMessages(ctx, bson.D{{}})

	fmt.Println(result, err)
	if err != nil {
		json.NewEncoder(rw).Encode(map[string]string{"erorr": "true"})
		return
	}

	json.NewEncoder(rw).Encode(result)

}
