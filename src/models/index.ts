import mongoose, { Schema, Document } from 'mongoose';


let UserSchema: Schema = new Schema({
  email: { type: String},
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  username: {type: String, required: true, unique: true},
  role: {type: String, enum: ["user", "admin"], default: "user"},
  picture: {type: String},
  created_at: Date
});


let CommunitySchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  Description: { type: String, required: true },
  moderators: [{type: Schema.Types.ObjectId, ref: 'User'}],
  created_at: Date

});

let PostSchema: Schema = new Schema({
  slug: {type: String, required: true, unique: true},
  text: {type: String},
  link: String,
  type: {type: String, enum: ["link", "text", "image", "video"]},
  Community: {type: Schema.Types.ObjectId, ref: 'Community'},
  created_at: Date

})

let PostVoteSchema: Schema = new Schema({
  post: {type: Schema.Types.ObjectId, 'ref': 'Post'},
  user: {type: Schema.Types.ObjectId, 'ref': 'User'},
  created_at: Date
})

// https://www.xuchao.org/docs/mongodb/use-cases/storing-comments.html#gsc.tab=0
let CommentSchema: Schema = new Schema({
  text: {type: String},
  slug: {type: String, required: true, unique: true},
  post: {type: Schema.Types.ObjectId, ref: 'Post'},
  parent: {type: Schema.Types.ObjectId, ref: 'Comment'},
  created_at: Date
})

let CommentVoteSchema: Schema = new Schema({
  comment: {type: Schema.Types.ObjectId, 'ref': 'Comment'},
  user: {type: Schema.Types.ObjectId, 'ref': 'User'},
  created_at: Date
})


const User = mongoose.model('User', UserSchema);
const Community = mongoose.model('Community', CommunitySchema);
const Post = mongoose.model('Post', PostSchema);
const Comment = mongoose.model('Comment', CommentSchema);

export {User, Community, Post, Comment}
