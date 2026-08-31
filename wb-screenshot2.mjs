import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
page.setViewportSize({ width: 1280, height: 900 })

await page.goto('http://localhost:5173/#/courses')
await page.waitForTimeout(3000)

// 点击字幕 tab
await page.click('button:has-text("字幕")')
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/wb-transcript-tab.png' })
console.log('transcript tab done')

// 点击练习计划 tab
await page.click('button:has-text("练习计划")')
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/wb-plan-tab.png' })
console.log('plan tab done')

await browser.close()
