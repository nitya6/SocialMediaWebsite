const mongoose=require('mongoose');
const schema=mongoose.Schema;
const passportLocalMongoose=require('passport-local-mongoose');
const userSchema=new mongoose.Schema({
    email:{
        type:String,
        required:true,
        unique:true
    },
    profilePic:{
        type:String,
        default:"https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"
    },
    Bio:{
        type:String,
        default:""
    },
    JDate:String,
    posts:[{type:schema.Types.ObjectId,ref:"Post"}],
    followers:[{type:schema.Types.ObjectId,ref:"User"}],
    following:[{type:schema.Types.ObjectId,ref:"User"}],
    notification:[String],
    newnoti:{type:Number,default:0}
})
userSchema.plugin(passportLocalMongoose);
module.exports=mongoose.model("User",userSchema);