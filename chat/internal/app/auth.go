package app

import (
	"context"
	firebase "firebase.google.com/go/v4"
	"log"
)

func InitializeFirebase() {
	firebaseapp, err := firebase.NewApp(context.Background(), nil)

	log.Default().Printf("initialized firebase %s", firebaseapp)
	if err != nil {
		log.Fatalf("error initializing app: %v\n", err)
	}
}
