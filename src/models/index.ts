import mongoose, { Schema, Document } from 'mongoose';


let UserSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true }
});


let CommunitySchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  Description: { type: String, required: true },
});

let PostSchema: Schema = new Schema({
  link: {type: String},
  text: {type: String}
})


export {UserSchema, CommunitySchema, PostSchema}
