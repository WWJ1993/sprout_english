import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
page.setViewportSize({ width: 1280, height: 900 })

// 首页
await page.goto('http://localhost:5173/#/')
await page.waitForTimeout(3000)  // wait for IndexedDB seed load
await page.screenshot({ path: '/tmp/wb-home.png', fullPage: false })
console.log('Home screenshot done')

// 课程页
await page.goto('http://localhost:5173/#/courses')
await page.waitForTimeout(2000)
await page.screenshot({ path: '/tmp/wb-courses.png', fullPage: false })
console.log('Courses screenshot done')

// 练习页
await page.goto('http://localhost:5173/#/practice')
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/wb-practice.png', fullPage: false })
console.log('Practice screenshot done')

// 学生管理页
await page.goto('http://localhost:5173/#/students')
await page.waitForTimeout(1000)
await page.screenshot({ path: '/tmp/wb-students.png', fullPage: false })
console.log('Students screenshot done')

await browser.close()
