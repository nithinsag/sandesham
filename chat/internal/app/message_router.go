package app

import (
	"context"
	"log"

	"github.com/diadara/sandesham/chat/internal/db"
	"github.com/go-redis/redis/v8"
)

type MessageRouter struct {
	rc *redis.Client
	ur *db.UserRepository
	mr *db.MembershipRepository
}

func NewMessageRouter(rc *redis.Client, ur *db.UserRepository) *MessageRouter {
	return &MessageRouter{rc: rc}
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
			mr.rc.Publish(ctx, msg.From.ID.Hex(), msg)
			mr.rc.Publish(ctx, toUser.ID.Hex(), msg)
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
