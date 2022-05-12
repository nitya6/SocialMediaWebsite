const mongoose=require('mongoose');
const schema=mongoose.Schema;
const postSchema=new mongoose.Schema({
   post:{
   status:String,
   photos:[String]
   },
   user:{
      type:schema.Types.ObjectId,
      ref:'User'
   },
   date:String,
   likes:[{type:schema.Types.ObjectId, ref:'User'}],
   comments:[
      {
         user:{type:schema.Types.ObjectId, ref:'User'},
         comment:String
      }
   ]
})
module.exports=mongoose.model('Post',postSchema);