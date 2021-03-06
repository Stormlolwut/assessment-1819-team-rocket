const localStrategy = require("passport-local").Strategy;
const facebookStrategy = require("passport-facebook").Strategy;
const googleStrategy = require("passport-google-oauth20").Strategy;

const passportJWT = require("passport-jwt");
const extractJWT = passportJWT.ExtractJwt;
const jwtStrategy = passportJWT.Strategy;

const User = require("../models/user");
const Room = require("../models/room");
const configAuth = require("./auth");

module.exports = function (passport) {
    // =========================================================================
    // LOCAL ===================================================================
    // =========================================================================

    passport.serializeUser(function (user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function (id, done) {
        User.find({id: id}, function (err, user) {
            done(err, user);
        });
    });

    passport.use(
        "local-signup",
        new localStrategy(
            {
                usernameField: "email",
                passwordField: "password",
                passReqToCallback: true
            },
            function (req, email, password, done) {
                process.nextTick(function () {
                    User.findOne({email: email}, function (err, user) {
                        if (err) {
                            console.err(err);
                            return done(err);
                        }

                        if (user) {
                            return done(
                                new Error(
                                    '{ "statusCode" : 400, "message" : "That email is already taken." }'
                                ),
                                false
                            );
                        } else {
                            let username = email.slice(0, email.lastIndexOf("@"));
                            let newUser = new User();

                            if (!newUser.validPassword(password)) {
                                return done(
                                    new Error(
                                        '{ "statusCode" : 400, "message" : "The password needs to contain minimal 8 characters, atleast 1 number, atleast 1 letter and atleast 1 unique character !#$%?" }'
                                    ),
                                    false
                                );
                            }

                            let discriminator = Math.random().toString().substr(2, 4);
                            newUser.id = username +  "#" + discriminator;
                            newUser.name = username;
                            newUser.discriminator = discriminator;
                            newUser.email = email;
                            newUser.password = newUser.generateHash(password);
                            newUser.save(function (err) {
                                if (err) return done(err);
                                return done(null, newUser);
                            });
                        }
                    });
                });
            }
        )
    );

    passport.use(
        "local-login",
        new localStrategy(
            {
                usernameField: "email",
                passwordField: "password",
                passReqToCallback: true
            },
            function (req, email, password, done) {
                process.nextTick(function () {
                    User.findOne({email: email}, function (err, user) {
                        if (err) {
                            console.log(err);
                            done(err);
                        }

                        if (!user)
                            return done(
                                new Error(
                                    '{ "statusCode" : 400, "message" : "User not found!"}'
                                ),
                                false
                            );

                        if (!password)
                            return done(
                                new Error(
                                    '{ "statusCode" : 400, "message" : "No local account stored!"}'
                                ),
                                false
                            );
                        if (!user.validHashedPassword(password))
                            return done(
                                new Error(
                                    '{ "statusCode" : 400, "message" : "Password is incorrect!"}'
                                ),
                                false
                            );
                        return done(null, user);
                    });
                });
            }
        )
    );

    // =========================================================================
    // FACEBOOK ================================================================
    // =========================================================================

    passport.use(
        new facebookStrategy(
            {
                clientID: configAuth.facebookAuth.clientID,
                clientSecret: configAuth.facebookAuth.clientSecret,
                callbackURL: configAuth.facebookAuth.callbackURL,
                profileFields: ["id", "displayName", "email"],
                passReqToCallback: true
            },
            function (req, token, refreshToken, profile, done) {
                process.nextTick(function () {
                    if (!req.user) {
                        User.findOne({email: profile.emails[0].value}, function (
                            err,
                            user
                        ) {
                            if (err) {
                                console.log(err);
                                return done(err);
                            }

                            if (user) {
                                //RELINK ACCOUNT
                                if (!user.hasProvider("facebook")) {
                                    let provider = {
                                        id: profile.id,
                                        token: token,
                                        provider: "facebook"
                                    };

                                    user.providers.push(provider);

                                    user.save(function (err) {
                                        if (err) return done(err);
                                        return done(null, user);
                                    });
                                }

                                return done(null, user);
                            } else {
                                //CREATE NEW ACCOUNT
                                let newUser = new User();
                                let discriminator = Math.random().toString().substr(2, 4);

                                newUser.id = profile.displayName.replace(/\s/g, "_") + "#" +  discriminator;
                                newUser.name = profile.displayName;
                                newUser.discriminator = discriminator;
                                newUser.email = profile.emails[0].value;

                                let provider = {
                                    id: profile.id,
                                    token: token,
                                    provider: "facebook"
                                };

                                newUser.providers.push(provider);

                                newUser.save(function (err) {
                                    if (err) return done(err);
                                    return done(null, newUser);
                                });
                            }
                        });
                    } else {
                        let provider = {
                            id: profile.id,
                            token: token,
                            provider: "facebook"
                        };
                        //LINK TO EXISTING ACCOUNT
                        let user = req.user;
                        user.providers.push(provider);

                        user.save(function (err) {
                            if (err) return done(err);
                            return done(null, user);
                        });
                    }
                });
            }
        )
    );

    // =========================================================================
    // GOOGLE===================================================================
    // =========================================================================

    passport.use(
        new googleStrategy(
            {
                clientID: configAuth.googleAuth.clientID,
                clientSecret: configAuth.googleAuth.clientSecret,
                callbackURL: configAuth.googleAuth.callbackURL,
                passReqToCallback: true
            },
            function (req, token, refreshToken, profile, done) {
                if (!req.user) {
                    process.nextTick(function () {
                        User.findOne({email: profile.emails[0].value}, function (
                            err,
                            user
                        ) {
                            if (err) {
                                console.log(err);
                                return done(err);
                            }

                            if (user) {
                                if (!user.hasProvider("google")) {
                                    let provider = {
                                        id: profile.id,
                                        token: token,
                                        provider: "google"
                                    };

                                    user.providers.push(provider);

                                    user.save(function (err) {
                                        if (err) return done(err);
                                        return done(null, user);
                                    });
                                }

                                return done(null, user);
                            } else {
                                let newUser = new User();

                                let discriminator = Math.random().toString().substr(2, 4);
                                newUser.id = profile.displayName.replace(/\s/g, "_") + "#" + discriminator;
                                newUser.name = profile.displayName;
                                newUser.discriminator = discriminator;
                                newUser.profile_picture = profile.photos[0].value;
                                newUser.email = profile.emails[0].value;

                                let provider = {
                                    id: profile.id,
                                    token: token,
                                    provider: "google"
                                };

                                newUser.providers.push(provider);

                                newUser.save(function (err) {
                                    if (err) return done(err);
                                    return done(null, newUser);
                                });
                            }
                        });
                    });
                } else {
                    let user = req.user;
                    let provider = user.getProvider("google");

                    if (provider == undefined) {
                        provider = {
                            id: profile.id,
                            token: token,
                            provider: "google"
                        };
                        user.providers.push(provider);
                    } else {
                        provider.token = token;
                    }

                    user.save(function (err) {
                        if (err) return done(err);

                        return done(null, user);
                    });
                }
            }
        )
    );

    // =========================================================================
    // JWT======================================================================
    // =========================================================================

    passport.use(
        new jwtStrategy(
            {
                jwtFromRequest: extractJWT.fromAuthHeaderAsBearerToken(),
                secretOrKey: configAuth.JWS.secret
            },
            function (payload, done) {
                process.nextTick(function () {
                    let userDocument = User.findOne({_id: payload.id});

                    userDocument.then(user => {
                            if (user) {
                                let roomDocument = Room.find({"users.user": user.id}).select(["id","users.roles"]);
                                roomDocument.then(rooms => {
                                        if (rooms) user.extra.push(rooms);
                                        return done(null, user);
                                    }).catch(err => {
                                    console.error(err);
                                    return done(err, false);
                                });
                            } else {
                                return done(null, false);
                            }
                        })
                        .catch(err => {
                            return done(err, false);
                        });
                });
            }
        )
    );
};
