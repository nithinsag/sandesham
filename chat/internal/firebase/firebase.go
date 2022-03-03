package firebase

import (
	"context"
	"fmt"
	"log"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
)

func NewAuthenticator() *Authenticator {
	app, err := firebase.NewApp(context.Background(), nil)
	if err != nil {
		fmt.Println("failerd to initialize firebase")
	}
	return &Authenticator{app: app}
}

type Authenticator struct {
	app *firebase.App
}

func (auth *Authenticator) VerifyToken(ctx context.Context, token string) (*auth.Token, error) {
	client, err := auth.app.Auth(ctx)
	if err != nil {
		log.Printf("error getting Auth client: %v\n", err)
	}

	decodedToken, err := client.VerifyIDToken(ctx, token)
	if err != nil {
		log.Printf("error verifying ID token: %v\n", err)
	}

	log.Printf("Verified ID token: %v\n", decodedToken)

	return decodedToken, err
}
