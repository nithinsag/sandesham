package main

import (
	"github.com/diadara/sandesham/chat/internal/app"
	"github.com/diadara/sandesham/chat/internal/cache"
	"github.com/diadara/sandesham/chat/internal/db"
	"github.com/diadara/sandesham/chat/internal/firebase"
	"go.uber.org/fx"
)

func Register(server *app.ChatServer) {
	server.Run()
}

func main() {
	//		app.Chat()
	//rc := app.NewRedisClient()
	//fmt.Println("redis connected", rc)
	fxapp := fx.New(
		fx.Provide(cache.NewRedisClient),
		fx.Provide(db.NewMongoClient, db.NewMessageRepository, db.NewMembershipRepository, db.NewUserRepository),
		fx.Provide(app.NewChatServer, app.NewApiRouter, app.NewMessageController, app.NewMessageRouter),
		fx.Provide(app.NewHub),
		fx.Provide(firebase.NewAuthenticator),
		fx.Invoke(Register))

	fxapp.Run()
}
