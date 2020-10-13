import mongoose, { Schema, Document } from "mongoose";

let UserSchema: Schema = new Schema({
  email: { type: String, required: true },
  name: { type: String, required: true },
  displayname: { type: String, unique: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  picture: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

let CommunitySchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  visibility: { type: String, enum: ["private", "public", "restricted"], default: "public" },
  status: { type: String, enum: ["enabled", "disabled"], default: "enabled" },
  rules: { type: String },
  icon: { type: String },
  moderators: [
    { user_id: { type: Schema.Types.ObjectId, ref: "User" }, name: String },
  ],
  owner: {
    user_id: { type: Schema.Types.ObjectId, ref: "User" },
    name: String,
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

let PostSchema: Schema = new Schema({
  // slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ["enabled", "disabled"], default: "enabled" },
  link: String,
  type: { type: String, enum: ["link", "text", "image", "video", "gif"], required: true },
  community: { type: Schema.Types.ObjectId, ref: "Community" },
  author: {
    user_id: { type: Schema.Types.ObjectId, ref: "User" },
    name: String,
  },
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

let PostVoteSchema: Schema = new Schema({
  post: { type: Schema.Types.ObjectId, ref: "Post" },
  user: { type: Schema.Types.ObjectId, ref: "User" },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// https://www.xuchao.org/docs/mongodb/use-cases/storing-comments.html#gsc.tab=0
let CommentSchema: Schema = new Schema({
  text: { type: String },
  slug: { type: String, required: true, unique: true },
  post: { type: Schema.Types.ObjectId, ref: "Post" },
  parent: { type: Schema.Types.ObjectId, ref: "Comment" },
  author: {
    user_id: { type: Schema.Types.ObjectId, ref: "User" },
    name: String,
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

let CommentVoteSchema: Schema = new Schema({
  comment: { type: Schema.Types.ObjectId, ref: "Comment" },
  user: { type: Schema.Types.ObjectId, ref: "User" },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);
const Community = mongoose.model("Community", CommunitySchema);
const Post = mongoose.model("Post", PostSchema);
const PostVote = mongoose.model("PostVote", PostVoteSchema);
const Comment = mongoose.model("Comment", CommentSchema);
const CommentVote = mongoose.model("CommentVote", CommentVoteSchema);

export { User, Community, Post, Comment, PostVote, CommentVote };
