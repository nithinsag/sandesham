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
	From      User      `json:"from"`
	Id        string    `json:"_id" bson:"_id,omitempty"`
	To        string    `json:"to"`
	Type      uint16    `json:"type"` // 0 -> message, 1 community message,
	Message   string    `json:"message"`
	Sent      bool      `json:"sent"`
	Recieved  bool      `json:"recieved"`
	Pending   bool      `json:"pending"`
	CreatedAt time.Time `json:"created_at" bson:"created_at,omitempty"`
}

func (msg *Message) IsDM() bool {
	if msg.Type == 0 {
		return true
	}
	return false
}

type User struct {
	Picture      string             `bson:"picture,omitempty" json:"picture"`
	CreatedAt    time.Time          `bson:"created_at,omitempty" json:"created_at"`
	Bio          string             `bson:"bio,omitempty" json:"bio"`
	V            int64              `bson:"__v,omitempty"`
	UpdatedAt    time.Time          `bson:"updated_at,omitempty" json:"updated_at"`
	IsSuperAdmin bool               `bson:"isSuperAdmin,omitempty"`
	Displayname  string             `bson:"displayname,omitempty" json:"displayname"`
	Email        string             `bson:"email,omitempty" json:"email"`
	CommentKarma int64              `bson:"commentKarma,omitempty"`
	Name         string             `bson:"name,omitempty" json:"name"`
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"_id"`
	PostKarma    int64              `bson:"postKarma,omitempty" json:"post_karma"`
	Role         string             `bson:"role,omitempty" json:"_"`
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

type Membership struct {
	Member    User      `bson:"member,omitempty"`
	Community Community `bson:"member,omitempty"`
}

type MessageRepository struct {
	mc *mongo.Collection
}

type UserRepository struct {
	mc *mongo.Collection
}
type MembershipRepository struct {
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
func NewUserRepository(mc *mongo.Client) *UserRepository {
	return &UserRepository{mc: mc.Database("myapp").Collection("users")}
}
func NewMembershipRepository(mc *mongo.Client) *MembershipRepository {
	return &MembershipRepository{mc: mc.Database("myapp").Collection("communitymemberships")}
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

func (ur *UserRepository) GetUserByEmail(ctx context.Context, email string) (*User, error) {

	fmt.Println("in repository", email)
	var user User
	err := ur.mc.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		log.Println("failed to get user")
	}

	return &user, err

}
func (ur *UserRepository) GetUserById(ctx context.Context, id string) (*User, error) {

	var user User
	objId, _ := primitive.ObjectIDFromHex(id)
	fmt.Println("fetching user with", id, objId, ur)
	result := ur.mc.FindOne(ctx, bson.M{"_id": objId})
	fmt.Println("got resutl")
	err := result.Decode(&user)
	if err != nil {
		log.Println("failed to get user")
	}

	return &user, err

}

func (mr *MembershipRepository) GetCommunities(ctx context.Context, user *User) ([]Membership, error) {

	var memberships []Membership
	cursor, err := mr.mc.Find(ctx, bson.M{"user._id": user.ID})

	err = cursor.All(ctx, &memberships)
	if err != nil {
		log.Println("failed to get user")
	}
	return memberships, err
}
func (mr *MembershipRepository) GetMembers(ctx context.Context, communityId string) ([]Membership, error) {

	var memberships []Membership
	cursor, err := mr.mc.Find(ctx, bson.M{"community._id": communityId})

	err = cursor.All(ctx, &memberships)
	if err != nil {
		log.Println("failed to get user")
	}
	return memberships, err
}
