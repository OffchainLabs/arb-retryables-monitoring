
import  argv  from './getClargs';
const { action } = argv
import { checkFailedRetryablesProcess } from './failed_retryables';


const main = async () => {
    // check action param
    switch (action) {
        case "failed_retryables":
            return checkFailedRetryablesProcess()
        default:
                throw new Error("Not a right action value");
    }
}

main()
.then(() => process.exit(0))
.catch(error => {
  console.error(error)
  process.exit(1)
})