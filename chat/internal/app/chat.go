package app

import (
	"flag"
	"fmt"
	"log"
	"net/http"

	"github.com/diadara/sandesham/chat/internal/firebase"
	"github.com/gorilla/mux"
)

var addr = flag.String("addr", ":8080", "http service address")

type ChatServer struct {
	router *mux.Router
	hub    *Hub
}

func (s *ChatServer) Run() {
	go s.hub.run()
	err := http.ListenAndServe(*addr, s.router)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}

	log.Default().Println("statted server")
}
func NewChatServer(hub *Hub, auth *firebase.Authenticator, apiRouter *mux.Router) *ChatServer {
	fmt.Println("this is a chat app")
	s := &ChatServer{hub: hub, router: apiRouter}
	flag.Parse()
	apiRouter.HandleFunc("/", serveHome)
	apiRouter.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, auth, w, r)
	})

	return s
}
