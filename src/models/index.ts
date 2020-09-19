import mongoose, { Schema, Document } from 'mongoose';


let UserSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  username: {type: String, required: true, unique: true},
  role: {type: String, enum: ["user", "admin"], default: "user"},
  picture: {type: String}
});


let CommunitySchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  Description: { type: String, required: true },
  moderators: [{type: Schema.Types.ObjectId, ref: 'User'}]
});

let PostSchema: Schema = new Schema({
  slug: {type: String, required: true, unique: true},
  text: {type: String},
  Community: {type: Schema.Types.ObjectId, ref: 'Community'}
})

let PostVoteSchema: Schema = new Schema({
  post: {type: Schema.Types.ObjectId, 'ref': 'Post'},
  user: {type: Schema.Types.ObjectId, 'ref': 'User'}
})

let CommentSchema: Schema = new Schema({
  text: {type: String},
  slug: {type: String, required: true, unique: true},
  post: {type: Schema.Types.ObjectId, ref: 'Post'}
})

let CommentVoteSchema: Schema = new Schema({
  comment: {type: Schema.Types.ObjectId, 'ref': 'Comment'},
  user: {type: Schema.Types.ObjectId, 'ref': 'User'}
})


const User = mongoose.model('User', UserSchema);
const Community = mongoose.model('Community', CommunitySchema);
const Post = mongoose.model('Post', PostSchema);

export {User, Community, Post}
