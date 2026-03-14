import nodemailer from 'nodemailer';

export  const sendMail = (email:String,mailSubject:String,body:String) => {

        const mailData:any = {
            from : {
            name:'E-Ashwa',
            address:process.env.NODE_EMAIL
            },
            to : email,
            subject : mailSubject,
            text : body
        }

        const transporter = nodemailer.createTransport({
            service : 'gmail',
            auth : {
                user : process.env.NODE_EMAIL,
                pass : process.env.NODEMAIL_PASS
            }
        })


        transporter.sendMail(mailData,async(err,info)=>{
            if(err){
                console.log(err) ;
                return false ;
            }
            else{
                console.log("Mail sent")
                return true ;   
            }
        })

        return true ;
}

export function getFormattedDate(): string {
    const date: Date = new Date();
  
    const day: number = date.getDate();
    const monthNames: string[] = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const month: string = monthNames[date.getMonth()];
    const year: number = date.getFullYear();
  
    const hours: number = date.getHours();
    const minutes: number = date.getMinutes();
    const ampm: string = hours >= 12 ? "PM" : "AM";
  
    const daySuffix = (day: number): string => {
      if (day > 3 && day < 21) return "th";
      switch (day % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
      }
    };
    const formattedHour: number = hours % 12 || 12;
    const formattedMinute: string = minutes < 10 ? "0" + minutes : minutes.toString();
  
    return `${day}${daySuffix(day)} ${month} ${year}, ${formattedHour}:${formattedMinute} ${ampm}`;
}
  