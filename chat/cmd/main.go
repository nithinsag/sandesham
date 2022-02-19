package main

import (
	"fmt"

	"github.com/diadara/sandesham/chat/internal/app"
	"github.com/diadara/sandesham/chat/internal/cache"
	"github.com/go-redis/redis/v8"
	"go.uber.org/fx"
)

func Register(rc *redis.Client) {
	fmt.Printf("got redis client", rc)
}

func main() {
	//		app.Chat()
	//rc := app.NewRedisClient()
	//fmt.Println("redis connected", rc)
	fxapp := fx.New(
		fx.Provide(cache.NewRedisClient),
		fx.Provide(app.NewHub),
		fx.Invoke(Register))

	fxapp.Run()
}
