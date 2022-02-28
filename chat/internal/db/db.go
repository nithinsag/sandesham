package db

import (
	"context"
	"errors"
	"fmt"
	"log"

	"os"
	"time"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Message struct {
	From      string    `json:"from"`
	Id        string    `json:"_id" bson:"_id,omitempty"`
	To        string    `json:"to"`
	Type      uint16    `json:"type"` // 0 -> message,
	Message   string    `json:"message"`
	Read      bool      `json:"read"`
	CreatedAt time.Time `json:"created_at" bson:"created_at,omitempty"`
}

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

type MessageRepository struct {
	mc *mongo.Collection
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

	return client
}

func NewMessageRepository(mc *mongo.Client) *MessageRepository {
	return &MessageRepository{mc: mc.Database("myapp").Collection("messages")}
}

func (mr *MessageRepository) SaveMessage(ctx context.Context, msg Message) (*mongo.InsertOneResult, error) {
	msg.CreatedAt = time.Now()
	return mr.mc.InsertOne(ctx, msg)
}

func (mr *MessageRepository) GetMessages(ctx context.Context, filter bson.D) ([]Message, error) {

	fmt.Println("in repository", filter)
	cursor, err := mr.mc.Find(ctx, bson.D{{}})

	fmt.Println(cursor, err)
	defer cursor.Close(ctx)
	var result []Message
	if err != nil {
		fmt.Println("in repository got error")
		return result, errors.New("couldn't fetch messages")
	}

	err = cursor.All(ctx, &result)

	fmt.Println(err)
	return result, err

}
