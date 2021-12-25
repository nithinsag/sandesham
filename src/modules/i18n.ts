import path from "path";
import i18n from 'i18n' 
i18n.configure({
  locales: ['en', 'id'],
  directory: path.join(__dirname,  '../../locales')
})
console.log(__dirname)
console.log(i18n.__("Hello"))
i18n.setLocale(process.env.LOCALE || 'en')
console.log(`Setting locale as ${process.env.LOCALE}`)
console.log(i18n.__("Hello"))
export const t = (s)=> i18n.__(s)