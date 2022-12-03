require('dotenv').config()

const list = JSON.parse(process.env.IGNORE_LIST)

console.log(list)

console.log(list[2])
