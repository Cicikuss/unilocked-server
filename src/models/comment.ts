import { getModelForClass, Ref } from "@typegoose/typegoose";
import { prop } from "@typegoose/typegoose/lib/prop";
import { Post } from "./post";
import { User } from "./user";

export class Comment {
  @prop()
  text?: string;

  @prop({ ref: () => Post })
  post?: Ref<Post>;

  @prop({ ref: () => User })
  author?: Ref<User>;

  @prop({ ref: () => User })
  likes?: Ref<User>[];

  @prop({ ref: () => User })
  dislikes?: Ref<User>[];
}

const CommentModel = getModelForClass(Comment);

export { CommentModel };
