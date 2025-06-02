import {v2 as cloudinary} from "cloudinary"
import fs from "fs"



    // Configuration
    cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET
    });


    const uploadOnCloudinary = async (localFilePath) => {
         try{
            if(!localFilePath) return null

            //upload the file on cloudinary
            const response = await cloudinary.uploader.upload(localFilePath,
                {
                    resource_type: "auto"
                }
            )
            // File uploaded successfully, delete local file if it exists
    if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
    }
    return response;
} catch (error) {
    // Log error for debugging
    console.error("Cloudinary upload error:", error);
    // Delete local file if it exists to clean up
    if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
    }
    return null;
}

    }

    

    export {uploadOnCloudinary}
    