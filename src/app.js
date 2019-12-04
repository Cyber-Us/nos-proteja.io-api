const app = require('express')()
const puppeteer = require('puppeteer');
const ssl = require('get-ssl-certificate')
const unirest = require('unirest');
const $ = require('cheerio')

const formatUrl = url => {
    url = url.replace('https://', '')
    url = url.replace('http://', '')
    url = url.replace('www.', '')
    url = url.replace('.com.br/', '.com.br')
    url = url.replace('.com/', '.com')

    return url
}

const getByUrl = async (url) => {
    let browserInstance
    return await puppeteer
        .launch()
        .then(browser => {
            browserInstance = browser
            
            return browser.newPage()
        })
        .then(page => page.goto(url).then(() => page.content()))
        .then(html => html)
        .then(html => {
            browserInstance.close()

            return html
        })
}

const isAccordingTheLaw = async (url) => {
    return await getByUrl(url)
        .then(html => {
            const footer = $('footer', html).text().toLowerCase()

            return {
                cnpj: footer.includes('cnpj'),
                address: footer.includes('rua') || footer.includes('av'),
                contactEmail: footer.includes('@') || footer.includes('fale conosco') || footer.includes('0800'),
                phone: footer.includes('telefone')
            }
        })
}

const getReclameAquiScore = async () => {
    return await getByUrl('https://www.reclameaqui.com.br/empresa/nubank/')
        .then(html => $('.company-score p:not(.score) span.ng-binding', html).text())
}

const getProconStatus = async url => {
    url = formatUrl(url)
    return await getByUrl('https://sistemas.procon.sp.gov.br/evitesite/list/evitesites.php')
        .then(html => $('#evitesites', html).html().includes(url))
}

const hasExplicitCnpj = async () => {
    return await getByUrl('https://nubank.com.br')
        .then(html => html.includes('CNPJ'))
}

const isValidHttps = async (url) => {
    url = formatUrl(url)

    return await ssl.get(url)
        .then(response => response)
        .catch(error => error)
}

const getRegistroBrInformation = async () => {
    
}

app.get('/', async (req, res) => {
    let { url } = req.query

    if (!url.includes('http')) {
        url = `https://${url}`
    }    

    const { cnpj, address, contactEmail, phone } = await isAccordingTheLaw(url)
    const sslResponse = await isValidHttps(url).catch(error => error)
    // const isAtProcon = await getProconStatus(url)

    const response = {
        cnpj,
        address,
        contactEmail,
        phone,
        // isAtProcon,
        hasValidSSL: !sslResponse.toString().includes('Error: getaddrinfo ENOTFOUND')
    }

    const keys = Object.keys(response)

    const totalPoints = keys.length

    const finalPoints = keys.filter(key => response[key]).length

    let status = 'negative'

    if (finalPoints >= (totalPoints / 2)) {
        status = 'positive'
    }

    let suggestedSites = {}

    if (status === 'negative') {
        suggestedSites = [
            'https://lojasegura.zepneus.com.br/',
            'https://www.dpaschoal.com.br'
        ]
    }

    return res.status(200).json({
        finalPoints,
        totalPoints,
        status,
        suggestedSites
    })
})

module.exports = app