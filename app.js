if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}
const express=require('express');
const mongoose=require('mongoose');
const ExpressError=require('./utility/ExpressError');
const catchAsync=require('./utility/catchAsync')
const session=require('express-session');
const ejs=require('ejs');
const {postSchema}=require('./schemas');
const path=require('path');
const methodOverride=require('method-override');
const ejsMate=require('ejs-mate');
const flash=require('connect-flash');
const passport = require('passport');
const date = require('date-and-time');
const LocalStrategy = require('passport-local');
const User=require('./Models/User');
const Post=require('./Models/Posts');
const app=express();
const multer = require('multer');
const { storage, cloudinary } = require('./cloudinary');
const upload = multer({ storage });
const moment=require("moment");
const { findById } = require('./Models/User');
const { default: axios } = require('axios');
const MongoStore=require('connect-mongo');
const dburl=process.env.DB_URL||'mongodb://localhost:27017/socialMedia'
mongoose.connect(dburl)
.then(()=>{
    console.log("Connected to database");
}
)
.catch(()=>{
    console.log("Database connection failed");
})
let url = 'https://newsapi.org/v2/everything?' +
          'q=Apple&' +
          'from=2022-05-11&' +
          'sortBy=popularity&' +
          `apiKey=${process.env.API_KEY}`;
let articles;        
 app.use(async(req,res,next)=>{
     await axios.get(url)
 .then(e=>{
     articles=e.data.articles;
 })  
 next();
})   
app.engine('ejs',ejsMate);
app.set('view engine','ejs');
app.set('views', path.join(__dirname, 'views'))
app.use(express.urlencoded({extended:true}));
app.use(methodOverride('_method'));
const store = MongoStore.create({
    mongoUrl:dburl
});

store.on("error", function (e) {
    console.log("SESSION STORE ERROR", e)
})
app.use(session({
    store,
    name:"session",
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: new Date(Date.now() + (30 * 86400 * 1000)),
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
  }))
  app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
const lastUrl=(req,res,next)=>{
    req.session.returnTo=req.originalUrl;
    next();
}
const validatePost = (req, res, next) => {
    const {status}=req.body;
    const photos=req.files.map((p)=>{
        return p.path;
    });
    const { error } = postSchema.validate({status,photos});
    if (error) {
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg, 400)
    } else {
        next();
    }
}
app.use((req,res,next)=>{
    res.locals.currentUser=req.user||null;
    res.locals.success=req.flash("success");
    res.locals.error=req.flash("error")
    next();
})
app.get('/',(req,res)=>{
    if(req.user){
        res.redirect(req.session.returnTo)
    }
    else{
    res.render('User/login.ejs');
    }
})
app.post('/register',catchAsync(async (req,res,next)=>{
   const {username,password,email}=req.body;
   const JDate=date.format(new Date(), 'DD/MM/YYYY');
   const user=new User({username,email,JDate});
   const registeredUser=await User.register(user,password);
   req.login(registeredUser, err => {
    if (err) return next(err);
    req.flash('success', 'Succesfully registered!');
    res.redirect(`/${user._id}`);
}).catch (e)
req.flash('error', e.message);
res.redirect('/');
}));
app.post('/search',catchAsync(async (req,res,next)=>{
  const {username}=req.body;
  const user=await User.findOne({username});
  res.redirect(`/${user._id}/profile`);
}))
app.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/' }),(req,res)=>{
    req.flash('success',"You are successfully logged in");
   res.redirect(`/${req.user._id}`);
})
app.get('/logout',(req,res)=>{
    req.logout();
    req.flash('success',"You are successfully logged out")
    res.redirect('/');
})
app.get('/:userid',catchAsync(async (req,res,next)=>{
    const {userid}=req.params;
    const user=await User.findById(userid);
    if(!(user._id.equals(req.user._id))){
        throw new ExpressError("Access Denied", 400)
    }
    else
    {
   let i=0;
   let art=[];
   while(i<10)
   {
       let x=Math.floor(articles.length*Math.random())
       if(!art.includes(articles[x]))
       {
           art.push(articles[x]);
           i++;
       }
   }  
   articles=art; 
    let Users=await User.find({});
    Users=Users.filter(e=>{
        return !(e._id.equals(req.user._id)) && !(req.user.following.includes(e._id))
    })
    req.session.returnTo=req.originalUrl;
    console.log(req.session.returnTo)
    const posts=await Post.find({}).populate('user').populate({
        path:'comments',
        populate:{
            path:'user'
        }
    });
        res.render('home.ejs',{user,posts,Users,articles});
}   
    
}))
app.get('/:userid/profile',catchAsync(async (req,res,next)=>{
    req.session.returnTo=req.originalUrl;
    console.log(req.session.returnTo)
    let Users=await User.find({});
    Users=Users.filter(e=>{
        return !(e._id.equals(req.user._id)) && !(req.user.following.includes(e._id))
    })
    const user=await User.findById(req.params.userid).populate({
        path:'posts',
        populate:{
            path:'comments',
            populate:{
                path:'user'
            }
        }
    }).populate('following').populate('followers');
   res.render('profile.ejs',{user,Users,articles});
}))
app.patch('/:userid/editprofile',upload.single('image'),catchAsync(async (req,res,next)=>{
    const {userid}=req.params;
    let profilePic;
    if(req.file){
    const {path}=req.file;
     profilePic=path;
    }
    else
    {
        profilePic=req.user.profilePic;
    }
    const {Bio}=req.body;
    await User.findByIdAndUpdate(userid,{Bio,profilePic});
    req.flash('success','Your profile has been edited');
    res.redirect(`${req.session.returnTo}`);
}))
app.post('/:id/add',upload.array('photos'),validatePost,catchAsync(async (req,res,next)=>{  
 const {status}=req.body;
 const photos=req.files.map((p)=>{
     return p.path;
 });
 const {id}=req.params;
 const user=await User.findById(id);
 const post={photos,status};
 const date=moment().format('lll'); 
 const p=new Post({post,user,date});
 await p.save();
 user.posts.unshift(p);
 await user.save();
 req.flash('success','You have successfully posted')
 res.redirect(`${req.session.returnTo}`);
}))
app.patch('/:userid/profilepic/delete',catchAsync(async(req,res,next)=>{
    const {userid}=req.params;
    const user=await User.findById(userid);
    user.profilePic="https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
    await user.save();
    req.flash("success",'Your profile has been edited');
    res.redirect(`${req.session.returnTo}`);
}))

app.delete('/:userid/:postid/delete',catchAsync(async(req,res,next)=>{
   const {userid,postid}=req.params;
   await User.findByIdAndUpdate(userid,{$pull:{posts:postid}});
   await Post.findByIdAndDelete(postid);
   req.flash("success","Post has been successfully deleted");
   res.redirect(`${req.session.returnTo}`);
}))
app.patch('/:userid/follow',catchAsync(async(req,res)=>{
    const userid=req.params.userid;
    const requser=req.user;
    const user=await User.findById(userid);
    if(requser.following.indexOf(userid)!==-1)
    {
        await User.findByIdAndUpdate({_id:requser._id},{$pull:{following:userid}})
        await User.findByIdAndUpdate({_id:userid},{$pull:{followers:requser._id}})
    }
    else
    {
 user.notification.unshift(`${requser.username} followed you`);
  user.newnoti=user.newnoti+1;
    requser.following.push(userid);
    user.followers.push(requser._id);
    }
    await user.save();
    await requser.save();
    res.redirect(`${req.session.returnTo}`);
    //res.redirect(`/${userid}/profile`);
}))
app.patch('/:userid/:postid/edit',upload.array('photos'),catchAsync(async (req,res)=>{
    const {userid}=req.params
    const user=await User.findById(req.params.userid);
  const post=await Post.findById(req.params.postid);
  const {deletePhotos,status}=req.body;
  const imgs=req.files.map(photo=>{
      return photo.path;
  })
  post.post.status=status
  post.post.photos.push(...imgs);
  await post.save();
  if(deletePhotos){
  for(let i of deletePhotos){
  post.post.photos=post.post.photos.filter(p=>
    p!=i)
  }
}
  await post.save();
  req.flash('success','Your post has been edited')
  res.redirect(`${req.session.returnTo}`)
}
))
app.patch('/:userid/:postid/comment',catchAsync(async (req,res,next)=>{
  const {userid,postid}=req.params;
  const user=await User.findById(userid);
  const post=await Post.findById(postid).populate('user');
  if(!user._id.equals(post.user._id)){
  post.user.notification.unshift(`${user.username} commented on your post`);
  console.log(post.user.notification)
  post.user.newnoti=post.user.newnoti+1;
  await post.user.save();
  }
  const c={
      user:userid,
      comment:req.body.comment
  }
  post.comments.push(c);
  await post.save();
  res.redirect(`${req.session.returnTo}`);
}))
app.patch('/:userid/:postid/delcomment',catchAsync(async(req,res,next)=>{
    const {i}=req.body;
    const {userid,postid}=req.params;
    const post=await Post.findById(postid);
    post.comments=post.comments.filter((c,j)=>parseInt(i)!=j);
    await post.save()
    res.redirect(`${req.session.returnTo}`);
}))
app.patch('/:userid/:postid/like',catchAsync(async(req,res,next)=>{
    const {userid,postid}=req.params;
    const post=await Post.findById(postid).populate('user');
    const user=await User.findById(userid);
    if(post.likes.indexOf(req.user._id)!==-1){
       await Post.findByIdAndUpdate({_id:postid},{$pull:{likes:req.user._id}});
    }
    else
    {   
    post.likes.push(req.user._id);
    if(!req.user._id.equals(post.user._id)){ 
    post.user.notification.unshift(`${req.user.username} liked your post`);
    post.user.newnoti=post.user.newnoti+1;
    }
    await post.user.save();
    await post.save();
    }
    res.redirect(`${req.session.returnTo}`);
}))
app.patch('/:userid/noti',catchAsync(async(req,res,next)=>{
    const {userid}=req.params
    const user=await User.findById(userid);
    user.newnoti=0;
    user.notification=[];
    await user.save();
   res.redirect(`${req.session.returnTo}`)
  }
  ))
app.get('*',(req,res,next)=>{
    next(new ExpressError("Page Not Found",404));
  })
app.use((err,req,res,next)=>{
    const {status=500}=err;
    res.status(status);
    res.render("error.ejs",{err});
})
const port=process.env.PORT||3000;
app.listen(port,()=>{
    console.log("Connected to port 3000");
})