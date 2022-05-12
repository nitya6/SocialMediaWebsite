const Joi=require('joi');
module.exports.postSchema=Joi.object().keys({
    status: Joi.string().allow(''),
    photos: Joi.when('status', { is: '', then: Joi.array().items(Joi.string()), otherwise:  Joi.array().items(Joi.string()).allow(null) })
  })