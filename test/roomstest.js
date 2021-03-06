const request = require('supertest');
const expect = require('chai').expect;
const should = require('chai').should();

const jwt = require("jsonwebtoken");

const mongoose = require('mongoose');
const database = require('../config/database');

const User = require('../models/user');
const Room = require('../models/room');
const Message = require('../models/message');

const app = require('express')();
const secret = require('../config/auth').JWS.secret;
const session = require("express-session");

const passport = require("passport");
const connectRoles = require("connect-roles");

app.use(session({secret: secret, resave: true, saveUninitialized: false}));
app.use(passport.initialize());
app.use(passport.session());

require("../config/passport")(passport);

const user = new connectRoles({
    failureHandler: function (req, res, action) {
        res.status(403).json({
            statusCode: 403,
            message: "Access Denied - You don't have permission to: " + action
        });
    }
});

app.use(user.middleware());
require("../config/roles")(user);

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

app.use(cookieParser(secret));
app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: true
    })
);

app.use('/rooms', require('../routes/rooms')(passport, user));

function getRequest(route, statusCode, done) {
    request(app)
        .get(route)
        .expect(statusCode)
        .end(function (err, res) {
            if (err) done(err);
            else done(null, res);
        });
}

function postRequest(route, statusCode, data, token, done) {
    request(app)
        .post(route)
        .set('Authorization', 'bearer ' + token)
        .send(data)
        .set('Accept', 'application/json')
        .expect(statusCode)
        .end(function (err, res) {
            if (err) return done(err);
            else done(null, res);
        });
}

function deleteRequest(route, statusCode, token, done) {
    request(app)
        .delete(route)
        .set('Authorization', 'bearer ' + token)
        .expect(statusCode)
        .end(function (err, res) {
            if (err) return done(err);
            else done(null, res);
        });
}

function putRequest(route, statusCode, data, token, done) {
    request(app)
        .put(route)
        .set('Authorization', 'bearer ' + token)
        .send(data)
        .set('Accept', 'application/json')
        .expect(statusCode)
        .end(function (err, res) {
            if (err) return done(err);
            else done(null, res);
        });
}

function insertRoom(name, password) {
    let room = new Room;
    room.name = name;
    room.password = password;

    room.save((err, room) => {
        if (err) throw new Error(err.message);
        else return room;
    });
}

function insertUser(id, name, done){
    let discriminator = Math.random().toString().substr(2, 4);
    let username = name;
    let newUser = new User();
    newUser.id = username + "#" + discriminator;
    newUser.name = username;
    newUser.discriminator = discriminator;
    newUser.email = `${name}@gmail.com`;
    newUser.password = newUser.generateHash("Testing123!");
    newUser.role = "admin";
    newUser.profile_picture = "";

    newUser.save((err, user) => {
        if (err) done(err.message);
        else {
            let result = Room.findOne({id: id});
            result.then(room => {
                if (room) {
                    room.users.push(newUser.id);
                    room.save();
                    return testUserId = newUser.name + '_' + newUser.discriminator;
                }
            }).catch(err => {
                done(err);
                return false;
            });
            return false;
        }
    });
}

function insertMessage(id, userId, line){
    let result = Room.findOne({id: id});
    result.then(room => {
        if (room) {
            let newMessage = {
                sender: userId,
                line: line
            };

            let messageResult = Message.create(newMessage);
            messageResult.then(msg => {
                room.messages.push(msg.id);
                room.save(err => {
                    if (err) {
                        console.error(err);
                        res.status(500).send("Internal Server Error");
                    } else {
                        res.status(201).json({msg, statusCode: 201, message: "Message Created"})
                    }
                });
            }).catch(err => {
                console.error(err);
                res.status(500).send("Internal Server Error")
            });

        }

    }).catch(err => {
        console.error(err);
        res.status(500).send("Internal Server Error");
    });

}

function deleteRoom(id, done) {
    let result = Room.deleteOne({id: id});
    result.then(room => {
        if (room) return true;
    }).catch(err => {
        done(err);
        return false;
    });
    return false;
}

let token = "";
let hashedUserId = "";
let testUserId;

before(function (done) {
    //Set up database connection
    mongoose.set('useCreateIndex', true);
    mongoose.connect(database.connection, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: true
    }).catch(err => {
        console.log(err);
        done(err);
    });

    //DELETE Test client if it hasnt been deleted yet
    let testRoom = Room.deleteOne({'name': "testroom"});
    testRoom.catch(err => {
        console.error(err);
        done(err);
    });

    let testClient = User.deleteOne({'name': "hashedclient"});
    testClient.catch(err => {
        console.error(err);
        done(err);
    });

    //Create valid user to test on
    let discriminator = Math.random().toString().substr(2, 4);
    let username = "hashedclient";
    let newUser = new User();
    newUser.id = username + "#" + discriminator;
    newUser.name = username;
    newUser.discriminator = discriminator;
    newUser.email = "hashedclient@gmail.com";
    newUser.password = newUser.generateHash("Testing123!");
    newUser.role = "admin";
    newUser.profile_picture = "";

    newUser.save((err, user) => {
        if (err) done(err.message);
        else {
            let payload = {id: user._id};
            token = jwt.sign(payload, secret);

            done()
        }

    });

    hashedUserId = newUser.name + '_' + newUser.discriminator;
});
describe('/ROOMS ', function () {

    before(function (done) {
        insertRoom('testroom');
        done();
    });
    describe('GET:', function () {
        it('should give all rooms and return 200', function (done) {
            getRequest('/rooms', 200, function (err, res) {

                if (err) {
                    done(err);
                } else {
                    expect(res.body).to.not.be.undefined;
                    expect(res.body).to.have.property('rooms');
                    expect(res.body).to.have.property('rooms').length.above(0);

                    done();
                }
            });
        });
    });
    after(function (done) {
        deleteRoom("testroom", done);
        done();
    });
    describe('POST:', function () {
        describe('an invalid room', function () {
            it('should not post room and return 400', function (done) {
                let room = new Room();
                postRequest('/rooms', 400, room, token, function (err, res) {

                    if (err) {
                        done(err);
                    } else {
                        expect(res.body.room).to.be.undefined;
                        done();
                    }
                });
            });
        });
        describe('a valid room', function () {
            it('should post room and return 200', function (done) {
                const roomName = "testroom2";

                let room = new Room();
                room.name = roomName;

                postRequest('/rooms', 201, room, token, function (err, res) {

                    if (err) {
                        done(err);
                    } else {
                        expect(res.body).to.not.be.undefined;
                        expect(res.body).to.have.property('room');
                        expect(res.body.room).to.have.property('name');
                        expect(res.body.room.name).to.be.equal(roomName);

                        done();
                    }
                });
            });
        });
        after(function (done) {
            deleteRoom("testroom2", done);
            done();
        });
    });
});
describe('/ROOMS/:ID ', function () {
    before(function (done) {
        insertRoom('testroom3');
        done();
    });
    describe('GET:', function () {
        describe('a valid room', function () {
            it('should give room and return 200', function (done) {
                const roomName = "testroom3";

                getRequest('/rooms/' + roomName, 200, function (err, res) {

                    if (err) {
                        done(err);
                    } else {
                        expect(res.body).to.not.be.undefined;
                        expect(res.body).to.have.property('room');
                        expect(res.body.room.name).to.be.equal(roomName);

                        done();
                    }
                });
            });
        });
        describe('an invalid room', function () {
            it('should give nothing room and return 404', function (done) {
                getRequest('/rooms/dfadsfasfd', 404, function (err, res) {

                    if (err) {
                        done(err);
                    } else {
                        expect(res.body).to.not.be.undefined;
                        expect(res.body.room).to.be.undefined;
                        done();
                    }
                });
            });
        })
    });
    after(function (done) {
        deleteRoom("testroom3", done);
        done();
    });
    before(function (done) {
        insertRoom('testroom4');
        done();
    });
    describe('PUT:', function () {
        describe('an invalid room', function () {
            it('should not update room and return 404', function (done) {
                let room = new Room();
                putRequest('/rooms/sadadsaad', 404, room, token, function (err, res) {

                    if (err) {
                        done(err);
                    } else {
                        expect(res.body.room).to.be.undefined;
                        done();
                    }
                });
            });
        });
        describe('a valid room', function () {
            it('should post room and return 200', function (done) {
                const roomName = "testroom4";
                const newName = "testroom5";

                let room = {
                    name: newName
                };

                putRequest('/rooms/' + roomName, 200, room, token, function (err, res) {

                    if (err) {
                        done(err);
                    } else {
                        console.log(res.body);
                        expect(res.body).to.not.be.undefined;
                        expect(res.body).to.have.property('room');
                        expect(res.body.room).to.have.property('name');
                        expect(res.body.room.name).to.be.equal(newName);

                        done();
                    }
                });
            });
        });
    });
    after(function (done) {
        deleteRoom("testroom5", done);
        done();
    });
    describe('DELETE:', function () {
        it('remove valid user and return 200', function (done) {
            const roomName = "testroom5";
            deleteRequest(`/rooms/${roomName}`, 200, token, done)
        });

    });
});
describe('/ROOMS/:ID/USERS', function () {


    before(function (done) {
        insertRoom('testroom15');
        testUserId = insertUser("testroom15", "testuser213123", done);
        insertMessage("testroom15", testUserId, "Hallo dit is een test message");
        done();
    });
    describe('POST:', function(){
        const testroomId = "testroom15";
        it('insert valid user into the room and return 200', function(done){
            postRequest(`/rooms/${testroomId}/users`, 200, {}, token, function(err, res){
                if (err) {
                    done(err);
                } else {
                    expect(res.body).to.not.be.undefined;
                    expect(res.body).to.have.property('users');
                    expect(res.body.users.length).to.be.above(0);
                    done();
                }
            });
        });
    });
    describe('GET:', function () {
        const testroomId = "testroom15";
        it('gets all users from room', function (done) {
            getRequest(`/rooms/${testroomId}/users`, 200, function (err, res) {
                if (err) {
                    done(err);
                } else {
                    expect(res.body).to.not.be.undefined;
                    expect(res.body).to.have.property('users');
                    done();
                }
            });
        });
    });
});
describe('/ROOMS/:ID/USERS/:USERID', function () {

    describe('GET:', function () {
        const testroomId = "testroom15";
        it('get valid user', function (done) {
            getRequest(`/rooms/${testroomId}/users/${testUserId}`, 404, function (err, res) {
                if (err) {
                    done(err);
                } else {
                    expect(res.body.users).to.be.undefined;
                    done();
                }
            });
        });
        it('get invalid user', function (done) {
            getRequest(`/rooms/${testroomId}/users/dfadfasfdsaf`, 404, function (err, res) {
                if (err) {
                    done(err);
                } else {
                    expect(res.body.users).to.be.undefined;
                    done();
                }
            });
        });
    });
    describe('DELETE:', function(){
        const testroomId = "testroom15";
        it('delete user and return 200', function(done){
            deleteRequest(`/rooms/${testroomId}/users/${testUserId}`, 200,  token, function(err, res){
                if (err) {
                    done(err);
                } else {
                    expect(res.body).to.not.be.undefined;
                    done();
                }
            });
        });
    });
});
describe('/ROOMS/:ID/USERS/MESSAGES', function () {

    describe('GET:', function () {
        const testroomId = "testroom15";
        it('get invalid user', function (done) {
            getRequest(`/rooms/${testroomId}/users/${testUserId}/messages`, 404, function (err, res) {
                if (err) {
                    done(err);
                } else {
                    expect(res.body.users).to.be.undefined;
                    done();
                }
            });
        });
    });
});

after(function (done) {
    deleteRoom('testroom15');
    done();
});
