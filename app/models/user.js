var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');



var User = db.Model.extend({
  tableName: 'users',
  initialize: function() {
    this.on('creating', this.hashPassword, this);
  },
  hashPassword: function(model, attrs, options) {
    // console.log('model:', model);
    // console.log('attrs:', attrs);
    // console.log('options:', options);

    // return a promise to saving event handler before storing hash password
    return new Promise(function(resolve, reject) {
      bcrypt.genSalt(10, function(err, salt) {
        if (err) { 
          console.log('error in genSalt', err);
        } else {
          bcrypt.hash(model.attributes.password, salt, null, function(err, hash) {
            if (err) { 
              reject(err);
            }
            model.set('password', hash);
            resolve(hash);
          });    
        }
      });
    });
  },
  checkPassword: function(attemptedPassword, hashedPassword) {
    return new Promise(function(resolve, reject) {
      bcrypt.compare(attemptedPassword, hashedPassword, function(err, res) {
        if (err) { 
          reject(err); 
        } else {
          resolve(res);
        }
      });
    });
  }
});

module.exports = User;