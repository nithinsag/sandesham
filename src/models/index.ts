import { text } from "body-parser";
import { SchemaMetaFieldDef } from "graphql";
import mongoose, { Schema, Document } from "mongoose";
import slug from "mongoose-slug-generator";
mongoose.plugin(slug);

let UserSchema: Schema = new Schema({
  email: { type: String, required: true },
  name: { type: String },
  pushMessageToken: String,
  displayname: { type: String, unique: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  postKarma: { type: Schema.Types.Number, default: 0 },
  commentKarma: { type: Schema.Types.Number, default: 0 },
  picture: { type: String },
  bio: { type: String, default: "" },
  isSuperAdmin: { type: Boolean, default: false },
  blockedUsers: [Schema.Types.ObjectId],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  loggedout_at: { type: Date },
});
export interface IUser extends Document {
  email: string;
  name: string;
  pushMessageToken: string;
  displayname: string;
  role: string;
  postKarma: number;
  commentKarma: number;
  picture: string;
  bio: string;
  isSupeAdmin: boolean;
  blockedUsers: string[];
  created_at: Date;
  updated_at: Date;
  loggedout_at: Date;
}
export interface ICommunityCategory extends Document {
  name: string;
}
let CommunityCategorySchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
});
export interface ICommunity extends Document {
  name: string;
  _id: string;
  score: number;
  feedWeight: number;
}
let CommunitySchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, unique: true, slug: "name" },
  description: { type: String, required: true },
  visibility: {
    type: String,
    enum: ["private", "public", "restricted"],
    default: "public",
  },
  status: { type: String, enum: ["enabled", "disabled"], default: "enabled" },
  type: { type: String },
  rules: { type: String },
  icon: { type: String },
  banner: { type: String },
  owner: {
    _id: { type: Schema.Types.ObjectId, ref: "User" },
    displayname: String,
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  isNSFW: { type: Boolean, default: false },
  skipPopular: { type: Boolean, default: false },
  score: { type: Schema.Types.Number, default: 0 },
  feedWeight: { type: Number, default: 0 },
});
CommunitySchema.index({ name: "text", description: "text" });
export interface IPost extends Document {
  title: string;
  slug?: string;
  link?: string;
  dynamicLink?: string;
  type: string;
  description?: string;
  author: { _id: string; displayname: string };
  community?: { _id: string; name: string };
  voteCount?: number;
  commentCount?: number;
  uniqueCommentors?: number;
  upvotes?: string[];
  downvotes?: string[];
  userVote?: number;
  created_at: Date;
  isDeleted: boolean;
  isRemoved: boolean;
  isPinned: boolean;
  updated_at: Date;
  reports: [Object];
}
let PostSchema: Schema = new Schema({
  slug: { type: String, slug: "title", unique: true },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ["enabled", "disabled"], default: "enabled" },
  link: String,
  dynamicLink: String,
  ogData: Schema.Types.Mixed,
  mediaMetadata: Schema.Types.Mixed,
  type: { type: String, enum: ["link", "text", "image", "video", "gif"] },
  community: {
    _id: { type: Schema.Types.ObjectId, ref: "Community", required: true },
    name: String,
  },
  author: {
    _id: { type: Schema.Types.ObjectId, ref: "User" },
    displayname: String,
  },
  voteCount: { type: Schema.Types.Number, default: 1 },
  commentCount: { type: Schema.Types.Number, default: 0 },
  uniqueCommentors: { type: Schema.Types.Number, default: 0 },
  tags: [String],
  // default upvote from creator
  upvotes: [Schema.Types.ObjectId],
  downvotes: [Schema.Types.ObjectId],
  reports: [{ _id: Schema.Types.ObjectId, reason: String }],
  isDeleted: { type: Boolean, default: false },
  isRemoved: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

PostSchema.index({ title: "text", description: "text" });
export interface ICommunityMembership extends Document {
  member: { _id: string; displayname: string };
  community: { _id: string; name: string };
  isAdmin: boolean;
  isBanned: boolean;
  isFavorite: boolean;
  disablePostNotification: boolean,
  subscribeToAdminNotification: boolean;
}

let CommunityMembershipSchema: Schema = new Schema({
  member: {
    displayname: String,
    _id: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  community: {
    name: String,
    _id: { type: Schema.Types.ObjectId, ref: "Community" },
  },
  isAdmin: { type: Schema.Types.Boolean, default: false },
  isBanned: { type: Schema.Types.Boolean, default: false },
  isFavorite: { type: Schema.Types.Boolean, default: false },
  disablePostNotification: { type: Schema.Types.Boolean, default: false },
  subscribeToAdminNotification: { type: Schema.Types.Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

CommunityMembershipSchema.index(
  { "member._id": 1, "community._id": 1 },
  { unique: true }
);

// https://www.xuchao.org/docs/mongodb/use-cases/storing-comments.html#gsc.tab=0
let CommentSchema: Schema = new Schema({
  text: { type: String },
  post: { type: Schema.Types.ObjectId, ref: "Post" },
  parent: { type: Schema.Types.ObjectId, ref: "Comment" },
  author: {
    _id: { type: Schema.Types.ObjectId, ref: "User" },
    displayname: String,
  },
  community: {
    _id: { type: Schema.Types.ObjectId, ref: "Community", required: true },
    name: String,
  },
  slug: { type: String, slug: ["parent", "text"], unique: true },
  voteCount: { type: Schema.Types.Number, default: 1 },
  upvotes: [Schema.Types.ObjectId],
  downvotes: [Schema.Types.ObjectId],
  reports: [{ _id: Schema.Types.ObjectId, reason: String }],
  level: Schema.Types.Number,
  children: [Schema.Types.ObjectId],
  ancestors: [Schema.Types.ObjectId],
  isDeleted: { type: Boolean, default: false },
  isRemoved: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export interface IComment extends Document {
  text: string;
  parent: string;
  post: string;
  community?: { _id: string; name: string };
  author: { _id: string; displayname: string };
  slug: string;
  voteCount: number;
  upvotes: string[];
  downvotes: string[];
  level: SVGAnimatedNumber;
  children: string[];
  userVote: number;
  isDeleted: boolean;
  isRemoved: boolean;
  created_at: Date;
  updated_at: Date;
  reports: [Object];
}

let MessageSchema: Schema = new Schema({
  text: { type: String },
  from: {
    _id: { type: Schema.Types.ObjectId, ref: "User" },
    displayname: String,
  },
  to: {
    _id: { type: Schema.Types.ObjectId, ref: "User" },
    displayname: String,
  },
  read: { type: Schema.Types.Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});

let NotificationSchema: Schema = new Schema({
  text: { type: String },
  to: { type: Schema.Types.ObjectId, ref: "User" },
  link: { type: String },
  detailedLink: { type: String },
  read: { type: Schema.Types.Boolean, default: false },
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

const User = mongoose.model<IUser>("User", UserSchema);
const Post = mongoose.model<IPost>("Post", PostSchema);
const Comment = mongoose.model<IComment>("Comment", CommentSchema);
const Message = mongoose.model("Message", MessageSchema);
const Notification = mongoose.model("Notification", NotificationSchema);
const Community = mongoose.model<ICommunity>("Community", CommunitySchema);
const CommunityCategory = mongoose.model<ICommunityCategory>(
  "CommunityCategory",
  CommunityCategorySchema
);
const CommunityMembership = mongoose.model<ICommunityMembership>(
  "CommunityMembership",
  CommunityMembershipSchema
);
// const CommentVote = mongoose.model("CommentVote", CommentVoteSchema);
// const PostVote = mongoose.model("PostVote", PostVoteSchema);

export async function connectToMongo() {
  let connection = await mongoose.connect(process.env.MONGO_URI!, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    autoIndex: true,
  });

  return connection;
}

export async function closeConnection() {
  await mongoose.connection.close();
}
export {
  User,
  Community,
  Post,
  Comment,
  Message,
  Notification,
  CommunityMembership,
  CommunityCategory,
};
