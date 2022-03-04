package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/diadara/sandesham/chat/internal/db"
	"github.com/go-redis/redis/v8"
)

type MessageRouter struct {
	rc *redis.Client
	ur *db.UserRepository
	mr *db.MembershipRepository
}

func NewMessageRouter(rc *redis.Client, ur *db.UserRepository, mr *db.MembershipRepository) *MessageRouter {
	return &MessageRouter{rc: rc, ur: ur, mr: mr}
}

// Message router recieves the message and publishes the message to
// all interested users
func (mr *MessageRouter) RouteMessage(ctx context.Context, msg *db.Message) {
	if msg.IsDM() {
		toUser, err := mr.ur.GetUserById(ctx, msg.To)
		// send response to the sender
		// send message to the target
		if err != nil {
			log.Println("failed to fetch user")
		}
		if toUser != nil {
			// publishing message to both users
			stMsg, _ := json.Marshal(msg)
			fmt.Println("publishing ", string(stMsg))
			mr.rc.Publish(ctx, msg.From.ID.Hex(), string(stMsg))
			mr.rc.Publish(ctx, toUser.ID.Hex(), string(stMsg))
		}
	} else {
		toCommunityMembers, err := mr.mr.GetMembers(ctx, msg.To)
		if err != nil {
			for _, member := range toCommunityMembers {
				mr.rc.Publish(ctx, member.Member.ID.Hex(), msg)
			}
		}
	}
	// Handle Group, to use multiplexing ?
}
