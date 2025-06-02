import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser" 

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({
    limit: "16kb"
}))
app.use(express.urlencoded({
    extended: true, // object ke andr b object
    limit: "16kb"
}))

app.use(express.static("public")) 
app.use(cookieParser())


// routes import 

import userRouter from './routes/user.routes.js'



//routes declaration -- router ko app alg rkhe ho ab router ko lane ke liye middleware lana padega
app.use("/api/v1/users",userRouter)   //jse hi userRouter bolega toh control de dege userRouter pe.. ar bolega wha pe ky kam karna hai kis route pe user ko leke jana hai

//    http://localhost:8000/api/v1/users/register

export {  app }