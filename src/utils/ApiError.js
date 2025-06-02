class ApiError extends Error {
    constructor(
        statusCode,
        message= "Something went wrong",
        errors = [],
        statck = ""
    ){
        super(message)
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false;
        this.errors = errors

        if(statck){
            this.statck = statck
        } else{
            Error.captureStackTrace(this, this.constructor) //statck trace ke andr hamne uska instance pss kar diya hai ki abhi kis context m baat kr rahe ho
        }
    }
}

export {ApiError}