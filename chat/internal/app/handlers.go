package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/diadara/sandesham/chat/internal/db"
	fb "github.com/diadara/sandesham/chat/internal/firebase"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func NewApiRouter(mc *MessageController, fbapp *fb.Authenticator) *mux.Router {
	router := mux.NewRouter()
	router.HandleFunc("/api/messages", mc.MessageList).Methods("GET")
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
func serveWs(hub *Hub, auth *fb.Authenticator, w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	token := params.Get("token")

	fmt.Println(token)
	// TODO impliment firebase
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	ctx := context.Background()
	decodedToken, err := auth.VerifyToken(ctx, token)

	if err != nil {
		json.NewEncoder(w).Encode(map[string]bool{"error": true})
		return
	}
	email := fmt.Sprint(decodedToken.Claims["email"])
	user, err := hub.ur.GetUserByEmail(ctx, email)
	client := &Client{hub: hub, conn: conn, user: user, token: decodedToken, send: make(chan []byte, 256)}
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
