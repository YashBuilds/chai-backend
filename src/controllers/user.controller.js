import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

//userId neche user instance se mil jaegi
const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false})

        return {accessToken, refreshToken}
        
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async(req,res) => {
    //  console.log("req.files:", req.files); 
    // get user details from frontend(postman ke through data le skte ho)
    // validation - not empty
    // check if user already exists: username , email
    // check for images, check for avatars
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token filed from response
    // chck for user creation
    // return res


    const { fullName, email, username, password } = req.body
    console.log("email:", email);

    if(
        [fullName, email, username, password].some((field) =>
        field.trim() === "")
    ){
        throw new ApiError(400, "All fields are required")
    }

    
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists")
    }
    //console.log(req.files);
    

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar field is required")
    }


    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar field is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser) {
        throw new ApiError(500,"Something went wrong while registering the user")
    }


    return res.status(201).json(
        new ApiResponse(200, createdUser,"User registered Successfully")
    )

})

const loginUser = asyncHandler(async(req,res) => {
    // req body -> data
    // username or email
    // find the user
    // password check
    // access and refresh token
    // send cookie and response

    const {email, username, password } = req.body

    if(!username && !email){
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]  //find krega value ko yha toh woh username ke base ya email ke base pe mil jae
    })
    if(!user){
        throw new ApiError(404, "User doesn't exist")
    }

    //findOne , updateOne ye sb jo method hai woh apke mongoDb ke through available hai, jo apne method bnya hai na isPassword Correct ,gernerate token vgra ye sb apke user mai available hai apka user upr wla hai jo apne db se wapas liya hai uska instance liya hai

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invlaid User Credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    // ab user ko ky bhejna hai
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // cookies jb bhi bhjte tb hme kuch options design krne padte cookies ke,options kuch ni hote its just a object
    const options = {
        httpOnly: true,
        secure : true //by default koi b modified kar sakta hai frontend se but by doing these ye cookies sirf server se modifiable hoti hai
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken, options)
    .cookie("refreshToken",refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User looged Out"))
})

const refreshAccessToken = asyncHandler(async(req, res) => {
    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
        
        if(!incomingRefreshToken){
            throw new ApiError(401, "unauthorized request");
        }

        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if(!user){
            throw new ApiError(401, "Invalid refresh Token");
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh Token is expired or used");
        }

        const options = {
            httpOnly: true,
            secure: true
        };

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token");
    }
});

const changeCurrentPassword = asyncHandler(async(req,res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req,res) => {
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "Current User fetched successfully"
    ))
})

const updateAccountDetails = asyncHandler(async(req,res) => {
    const {fullName, email} = req.body

    if(!fullName || !email){
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email  //both conventions are same
            }
        },
        { new : true }
    ).select("-password")


    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res) => {
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400, "avatar field is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar")
    }

   const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new : true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "avatar image updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req,res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover Image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new : true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async(req,res) => {
    const {username} = req.params //url se

    if(!username){
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()  //phle hmne user ko match kara
            }
        },
        {
            $lookup: {
                from: "subscriptions", //uske bad hamne count kiya ki uske subscriber kitne hai channel ke through
                localField: "_id",
                foreignField: "channel",
                as: "subscribers" //jo name dena hai dedo
            }
        },
        {
            $lookup: {
                from: "subscriptions", //fir hamne count kiya ki apne kitno ko subscribe kr rkha hai uske susciber ke through
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },

        // 3rd pipeline mai , original jo user object tha uske andr 2-3 field ar add krdi 
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers" //field hai isliye dollar
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        // project ky hota hai projection deta hai ki mai sarri value ko nahi project kruga wha pe jo bhi usko demand kar raha hai, mai usko selected cheeze dunga
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "user channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})
// const getWatchHistory = asyncHandler(async(req,res) => {
//     // req.user._id //yha pe string mila hai ar usse string ko jb ham mongoose ke through usse krte hai find findById toh usko directly pass kar dete hai, mongoose actually mai bts mai sab kuch dekh leta hai;

//     //ham user gye usme se watchHistory nikali, watchHistory nikal ke sarre document find karni thi, uske bad hamne dekha ki find toh kr liye lkin bhut sari document hai usmse se ek field jo owner wla hai, toh humne sub pipeline lgyi ky loopkup kr dena isse owner se wapas ana user pe ar sari values find kar dena

//     const user = await User.aggregate([
//         {
//             $match: {
//                 _id: new mongoose.Types.ObjectId(req.user._id)
//             }
//         },
//         {
//             $lookup: {
//                 from: "videos",
//                 localField: "watchHistory",
//                 foreignField: "_id",
//                 as: "watchHistory",
//                 pipeline: [
//                     {}
//                 ]
//             }
//         }
//     ])
// })

export {
     registerUser,
     loginUser,
     logoutUser,
     refreshAccessToken,
     changeCurrentPassword,
     getCurrentUser,
     updateAccountDetails,
     updateUserAvatar,
     updateUserCoverImage,
     getUserChannelProfile,
     getWatchHistory
    }