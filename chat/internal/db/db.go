package db

import (
	"context"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log"
	"os"
	"time"
)

type User struct {
	Picture      string             `bson:"picture,omitempty"`
	CreatedAt    time.Time          `bson:"created_at,omitempty"`
	Bio          string             `bson:"bio,omitempty"`
	V            int64              `bson:"__v,omitempty"`
	UpdatedAt    time.Time          `bson:"updated_at,omitempty"`
	IsSuperAdmin bool               `bson:"isSuperAdmin,omitempty"`
	Displayname  string             `bson:"displayname,omitempty"`
	Email        string             `bson:"email,omitempty"`
	CommentKarma int64              `bson:"commentKarma,omitempty"`
	Name         string             `bson:"name,omitempty"`
	ID           primitive.ObjectID `bson:"_id,omitempty"`
	PostKarma    int64              `bson:"postKarma,omitempty"`
	Role         string             `bson:"role,omitempty"`
	BlockedUsers []interface{}/*  */ `bson:"blockedUsers,omitempty"`
}

type Community struct {
	Name      string             `bson:"name,omitempty"`
	CreatedAt time.Time          `bson:"created_at,omitempty"`
	Slug      string             `bson:"slug,omitempty"`
	V         int64              `bson:"__v,omitempty"`
	UpdatedAt time.Time          `bson:"updated_at,omitempty"`
	ID        primitive.ObjectID `bson:"_id,omitempty"`
}

type CommunityMembership struct {
	Member    User      `bson:"member,omitempty"`
	Community Community `bson:"member,omitempty"`
}

func NewMongoClient() *mongo.Client {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		log.Fatal("You must set your 'MONGO_URI' environmental variable. See\n\t https://docs.mongodb.com/drivers/go/current/usage-examples/#environment-variable")
	}
	client, err := mongo.Connect(context.TODO(), options.Client().ApplyURI(uri))
	if err != nil {
		panic(err)
	}
	// coll := client.Database("myapp").Collection("users")
	// title := "Back to the Future"
	// var result User
	// err = coll.FindOne(context.TODO(), bson.D{}).Decode(&result)
	// if err == mongo.ErrNoDocuments {
	// fmt.Printf("No document was found with the title %s\n", title)
	// return
	// }
	// if err != nil {
	// panic(err)
	// }
	// fmt.Println(result)
	// jsonData, err := json.MarshalIndent(result, "", "    ")
	// if err != nil {
	// panic(err)
	// }
	// fmt.Printf("%s\n", jsonData)
	return client
}
