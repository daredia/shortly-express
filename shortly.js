var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
//var cookieParser = require('cookie-parser');
//sessions no longer needs cookie parser for it to work since 1.5.0
var session = require('express-session');

// require('node-monkey').start({ host: '127.0.0.1', port: '50500'});

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
//app.use(cookieParser('shhhh, very secret'));

//set the secure to true when we handle https!!!!!!!!!!!
app.use(session({
  secret: 'shhhh, very secret',
  resave: false,
  saveUninitialized: true,
  cookie: {secure: false}
}));


var restrict = function(req, res, next) {
  console.log('~in restricted~');
  if (req.session.user) {
    console.log('~Session found!~');
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
};


app.get('/', restrict, 
function(req, res) {
  console.log('in base');
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', restrict,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    //console.log('links inside /links 1:', links);
    Link.where({'uid': req.session.user}).fetch().then(function(queryLinks) {
      console.log('links inside /links 2:', queryLinks);
      res.status(200).send(queryLinks);
    });
  });
});

app.post('/links', restrict,
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri, uid: req.session.user }).fetch().then(function(found) {
    if (found) {
      console.log('found is true:', found);
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }
        console.log('current session user is ', req.session.user);
        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin,
          uid: req.session.user
        })
        .then(function(newLink) {
          console.log('new link', newLink);
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/login', function(req, res) {
  console.log('open login page');
  res.render('login');
});
app.post('/login',
  function(req, res) {
    User.where('username', req.body.username).fetch().then(function(user) {
      console.log(user);
      if (user) {
        console.log('user exists, check password');
        user.checkPassword(req.body.password, user.attributes.password)
          .then(function(match) {
            if (match) {
              console.log('password matched');
              req.session.regenerate(function() {
                console.log('in request.session.regenerate');
                req.session.user = user.attributes.id;
                res.redirect('/');
              });
            } else {
              res.redirect('/login');
            }
          })
          .catch(function(err) {
            res.redirect('/login');
          });
      } else {
        console.log('user does not exist, wrong username');
        res.redirect('/login'); 
      }
    });
  });

app.get('/signup', function(req, res) {
  res.render('signup');
});
app.post('/signup',
  function(req, res) {
    new User(req.body).save().then(function() {
      res.redirect('/');
    }).catch(function(e) {
      console.log('signup ERROR', e);
    });
  });


app.get('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('/login');
  });
});



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
