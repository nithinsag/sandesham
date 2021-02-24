import mongoose, { Schema, Document } from "mongoose";

let UserSchema: Schema = new Schema({
  email: { type: String, required: true },
  name: { type: String },
  pushMessageToken: String,
  displayname: { type: String, unique: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  postKarma: {type: Schema.Types.Number, default:0},
  commentKarma: {type: Schema.Types.Number, default:0},
  picture: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

let CommunitySchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  visibility: {
    type: String,
    enum: ["private", "public", "restricted"],
    default: "public",
  },
  status: { type: String, enum: ["enabled", "disabled"], default: "enabled" },
  rules: { type: String },
  icon: { type: String },
  moderators: [
    { _id: { type: Schema.Types.ObjectId, ref: "User" }, name: String },
  ],
  owner: {
    _id: { type: Schema.Types.ObjectId, ref: "User" },
    name: String,
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

let PostSchema: Schema = new Schema({
  slug: { type: String },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ["enabled", "disabled"], default: "enabled" },
  link: String,
  ogData: Schema.Types.Mixed,
  type: { type: String, enum: ["link", "text", "image", "video", "gif"] },
  community: { type: Schema.Types.ObjectId, ref: "Community" },
  author: {
    _id: { type: Schema.Types.ObjectId, ref: "User" },
    name: String,
  },
  voteCount: { type: Schema.Types.Number, default: 0 },
  commentCount: { type: Schema.Types.Number, default: 0 },
  upvotes: [Schema.Types.ObjectId],
  downvotes: [Schema.Types.ObjectId],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

let CommunityMembership: Schema = new Schema({
  user: {
    name: String,
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  community: {
    name: String,
    community: { type: Schema.Types.ObjectId, ref: "Community" },
  },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// https://www.xuchao.org/docs/mongodb/use-cases/storing-comments.html#gsc.tab=0
let CommentSchema: Schema = new Schema({
  text: { type: String },
  post: { type: Schema.Types.ObjectId, ref: "Post" },
  parent: { type: Schema.Types.ObjectId, ref: "Comment" },
  author: {
    _id: { type: Schema.Types.ObjectId, ref: "User" },
    name: String,
  },
  voteCount: { type: Schema.Types.Number, default: 0 },
  upvotes: [Schema.Types.ObjectId],
  downvotes: [Schema.Types.ObjectId],
  level: Schema.Types.Number,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

let MessageSchema: Schema = new Schema({
  text: { type: String },
  from: {
    _id: { type: Schema.Types.ObjectId, ref: "User" },
    name: String,
  },
  to: {
    _id: { type: Schema.Types.ObjectId, ref: "User" },
    name: String,
  },
  read: {type: Schema.Types.Boolean, default: false},
  created_at: { type: Date, default: Date.now },
});

// TODO: Refactor when more users
// let CommentVoteSchema: Schema = new Schema({
//   comment: { type: Schema.Types.ObjectId, ref: "Comment" },
//   user: { type: Schema.Types.ObjectId, ref: "User" },
//   created_at: { type: Date, default: Date.now },
//   updated_at: { type: Date, default: Date.now },
// });
// let PostVoteSchema: Schema = new Schema({
//   post: { type: Schema.Types.ObjectId, ref: "Post" },
//   user: { type: Schema.Types.ObjectId, ref: "User" },
//   created_at: { type: Date, default: Date.now },
//   updated_at: { type: Date, default: Date.now },
// });

const User = mongoose.model("User", UserSchema);
const Community = mongoose.model("Community", CommunitySchema);
const Post = mongoose.model("Post", PostSchema);
const Comment = mongoose.model("Comment", CommentSchema);
const Message = mongoose.model("Message", MessageSchema);
// const CommentVote = mongoose.model("CommentVote", CommentVoteSchema);
// const PostVote = mongoose.model("PostVote", PostVoteSchema);

export { User, Community, Post, Comment, Message };
