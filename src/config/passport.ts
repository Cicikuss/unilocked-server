import passport, { use } from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { UserController } from "../modules/controllers/user-controller";
import bcrypt from "bcrypt";
import { tr } from "../modules/services/translator";
import { User } from "../models/user";
import e from "connect-flash";
import { UserModel } from "../resolved-models";

export default class PassportConfig {
  public init() {
    const userController = new UserController();
    passport.use(
      new LocalStrategy({ usernameField: "email" }, (email, password, done) => {
        //match user
        UserModel.find({ email: email })
          .select("+password +postsSaved")
          .populate(["roles"])
          .exec()
          .then((users) => {
            if (users.length == 0) {
              return done(null, false, { message: tr("Email not registered") });
            }
            const user = users[0];
            //math passwords
            bcrypt.compare(password, user.password, (err, isMatch) => {
              if (err) throw err;
              if (isMatch) {
                return done(null, user);
              } else {
                return done(null, false, { message: tr("Password incorrect") });
              }
            });
          })
          .catch((err) => {
            console.log(err);
          });
      })
    );
    passport.serializeUser(function (user: any, done) {
      done(null, user._id);
    });
    passport.deserializeUser(function (id: string, done) {
      UserModel.findById(id)
        .select("+postsSaved")
        .populate("roles")
        .exec()
        .then(async (user: any) => {
          if (user) {
            delete user.password;
          }
          done(null, user);
        })
        .catch((err) => {
          done(err, null);
        });
    });
  }
}
