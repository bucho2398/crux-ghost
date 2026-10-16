import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests',timeout:180000,workers:1,use:{baseURL:'http://127.0.0.1:8080',headless:true},webServer:{command:'python3 -m http.server 8080 --directory web',url:'http://127.0.0.1:8080',reuseExistingServer:!process.env.CI},reporter:[['list'],['html',{open:'never'}]]});
