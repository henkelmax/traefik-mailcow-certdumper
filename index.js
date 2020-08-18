// @ts-check

const fs = require('fs')
const { createLogger, format, transports } = require('winston')
const { spawnSync } = require('child_process')

const logger = createLogger()

const acmeJsonPath = process.env.ACME_JSON_PATH || './acme.json'
const domain = process.env.DOMAIN || 'example.com'
const certificatePath = process.env.CERT_PATH || './cert.pem'
const keyPath = process.env.KEY_PATH || './key.pem'
const runAtStart = process.env.RUN_AT_START === 'true' || true


if (process.env.NODE_ENV === 'production') {
    logger.add(new transports.Console({ format: format.combine(format.timestamp(), format.json()), level: 'info' }))
} else {
    logger.add(new transports.Console({ format: format.simple(), level: 'debug' }))
}

fs.watchFile(acmeJsonPath, (curr, prev) => {
    dumpCerts()
})

logger.info('CertDumper started')
logger.info(`Domain: '${acmeJsonPath}'`)
logger.info(`ACME JSON path: '${domain}'`)
logger.info(`Certificate path: '${certificatePath}'`)
logger.info(`Key path: '${keyPath}'`)

if (runAtStart) {
    logger.info(`File ${acmeJsonPath} changed`)
    dumpCerts()
}

function dumpCerts() {
    try {
        const acmeJson = JSON.parse(fs.readFileSync(acmeJsonPath, 'utf8'))
        // @ts-ignore
        const cert = Object.values(acmeJson).flatMap(element => element.Certificates).find(element => element.domain.main === domain)

        if (!cert) {
            logger.info(`No certificate for '${domain}' found`)
            return
        }

        fs.writeFileSync(certificatePath, Buffer.from(cert.certificate, 'base64'))
        fs.writeFileSync(keyPath, Buffer.from(cert.key, 'base64'))

        logger.info('Successfully dumped certificates')

        restartMailcow()
    } catch (err) {
        logger.error(`Error dumping certificates: ${err}`)
    }
}

function restartMailcow() {
    logger.info('Reloading postfix')
    let postfixResult = spawnSync('docker exec $(docker ps -qaf name=postfix-mailcow) postfix reload', { shell: '/bin/ash' })
    if (postfixResult.status !== 0) {
        printOutput(postfixResult.output)
        logger.error(`Reloading postfix failed with exit code ${postfixResult.status}: ${postfixResult.error}`)
    }

    logger.info('Reloading nginx')
    let nginxResult = spawnSync('docker exec $(docker ps -qaf name=nginx-mailcow) nginx -s reload', { shell: '/bin/ash' })
    if (nginxResult.status !== 0) {
        printOutput(nginxResult.output)
        logger.error(`Reloading nginx failed with exit code ${nginxResult.status}: ${nginxResult.error}`)
    }

    logger.info('Reloading dovecot')
    let dovecotResult = spawnSync('docker exec $(docker ps -qaf name=dovecot-mailcow) dovecot reload', { shell: '/bin/ash' })
    if (dovecotResult.status !== 0) {
        printOutput(dovecotResult.output)
        logger.error(`Reloading dovecot failed with exit code ${dovecotResult.status}: ${dovecotResult.error}`)
    }
}

function printOutput(output) {
    if (!output) {
        return
    }

    for (let line of output) {
        logger.error(line)
    }
}