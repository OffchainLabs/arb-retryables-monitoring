export const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

export const requireEnvVariables = (envVars: any) => {
  for (const envVar of envVars) {
    if (!process.env[envVar]) {
      throw new Error(`Error: set your '${envVar}' environmental variable `)
    }
  }
  console.log('Environmental variables properly set 👍')
}

export const arbLog = async (text: any) => {
  let str = '🔵'
  for (let i = 0; i < 25; i++) {
    await wait(40)
    if (i == 12) {
      str = `🔵${'🔵'.repeat(i)}🔵`
    } else {
      str = `🔵${' '.repeat(i * 2)}🔵`
    }
    while (str.length < 60) {
      str = ` ${str} `
    }

    console.log(str)
  }

  console.log('Starting retryables checker for chainId:', text)
  await wait(2000)

  console.log('Lets')
  await wait(1000)

  console.log('Go ➡️')
  await wait(1000)
  console.log('...🚀')
  await wait(1000)
  console.log('')
}
