
import  argv  from './getClargs';
const { action } = argv
import { checkFailedRetryablesLoop} from './failed_autoredeems';


const main = async () => {
    // check action param
    switch (action) {
        case "failed_autoredeems":
            return checkFailedRetryablesLoop()
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