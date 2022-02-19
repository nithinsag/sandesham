package app

import (
	"flag"
	"fmt"
	"log"
	"net/http"
)

var addr = flag.String("addr", ":8080", "http service address")

type ChatServer struct {
	hub *Hub
}

func (s *ChatServer) run() {
	go s.hub.run()
	err := http.ListenAndServe(*addr, nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
func NewChatServer(hub *Hub) *ChatServer {
	fmt.Println("this is a chat app")
	s := &ChatServer{hub: hub}
	flag.Parse()
	http.HandleFunc("/", serveHome)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})

	return s
}
