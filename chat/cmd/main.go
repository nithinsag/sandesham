package main

import (
	"fmt"
	"github.com/diadara/sandesham/chat/internal/app"
)

func main() {
	//		app.Chat()
	rc := app.NewRedisClient()
	fmt.Println("redis connected", rc)
}
