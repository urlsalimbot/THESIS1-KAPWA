# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 0 |
| Low | 1 |
| Informational | 4 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 65    |
| Low | Exceeded High | http://localhost:3000 | Percentage of responses with status code 4xx | 99 % |
| Info | Informational | http://localhost:3000 | Percentage of endpoints with content type application/json | 100 % |
| Info | Informational | http://localhost:3000 | Percentage of endpoints with method DELETE | 1 % |
| Info | Informational | http://localhost:3000 | Percentage of endpoints with method GET | 50 % |
| Info | Informational | http://localhost:3000 | Percentage of endpoints with method PATCH | 3 % |
| Info | Informational | http://localhost:3000 | Percentage of endpoints with method POST | 44 % |
| Info | Informational | http://localhost:3000 | Count of total endpoints | 1,850    |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Cookie No HttpOnly Flag | Low | Systemic |
| A Client Error response code was returned by the server | Informational | 1847 |
| Non-Storable Content | Informational | Systemic |
| Session Management Response Identified | Informational | 31 |
| User Agent Fuzzer | Informational | Systemic |




## Alert Detail



### [ Cookie No HttpOnly Flag ](https://www.zaproxy.org/docs/alerts/10010/)



##### Low (Medium)

### Description

A cookie has been set without the HttpOnly flag, which means that the cookie can be accessed by JavaScript. If a malicious script can be run on this page then the cookie will be accessible and can be transmitted to another site. If this is a session cookie then session hijacking may be possible.

* URL: http://localhost:3000/api/v1
  * Node Name: `http://localhost:3000/api/v1`
  * Method: `GET`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `Set-Cookie: csrf-token`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health
  * Node Name: `http://localhost:3000/api/v1/health`
  * Method: `GET`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `Set-Cookie: csrf-token`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/enable
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/enable`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `Set-Cookie: csrf-token`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/refresh
  * Node Name: `http://localhost:3000/api/v1/auth/refresh`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `Set-Cookie: csrf-token`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/pull
  * Node Name: `http://localhost:3000/api/v1/sync/pull`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `Set-Cookie: csrf-token`
  * Other Info: ``

Instances: Systemic


### Solution

Ensure that the HttpOnly flag is set for all cookies.

### Reference


* [ https://owasp.org/www-community/HttpOnly ](https://owasp.org/www-community/HttpOnly)


#### CWE Id: [ 1004 ](https://cwe.mitre.org/data/definitions/1004.html)


#### WASC Id: 13

#### Source ID: 3

### [ A Client Error response code was returned by the server ](https://www.zaproxy.org/docs/alerts/100000/)



##### Informational (High)

### Description

A response code of 400 was returned by the server.
This may indicate that the application is failing to handle unexpected input correctly.
Raised by the 'Alert on HTTP Response Code Error' script

* URL: http://localhost:3000/api/v1/announcements/id
  * Node Name: `http://localhost:3000/api/v1/announcements/id`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/
  * Node Name: `http://localhost:3000/api/v1/announcements/id/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/id
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/id`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/id/
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/id/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/id
  * Node Name: `http://localhost:3000/api/v1/csr/id`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/id/
  * Node Name: `http://localhost:3000/api/v1/csr/id/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/cleanup%3Fdays=days
  * Node Name: `http://localhost:3000/api/v1/filing/cleanup (days)`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/cleanup/
  * Node Name: `http://localhost:3000/api/v1/filing/cleanup/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id
  * Node Name: `http://localhost:3000/api/v1/filing/id`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id/
  * Node Name: `http://localhost:3000/api/v1/filing/id/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/meet
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/meet`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/meet/
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/meet/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id
  * Node Name: `http://localhost:3000/api/v1/notifications/id`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/
  * Node Name: `http://localhost:3000/api/v1/notifications/id/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/id
  * Node Name: `http://localhost:3000/api/v1/programs/id`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/id/
  * Node Name: `http://localhost:3000/api/v1/programs/id/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/id
  * Node Name: `http://localhost:3000/api/v1/users/id`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/id/
  * Node Name: `http://localhost:3000/api/v1/users/id/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000
  * Node Name: `http://localhost:3000`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000%3Faaa=bbb
  * Node Name: `http://localhost:3000 (aaa)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000 (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/
  * Node Name: `http://localhost:3000/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/.DS_Store
  * Node Name: `http://localhost:3000/.DS_Store`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/._darcs
  * Node Name: `http://localhost:3000/._darcs`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/.bzr
  * Node Name: `http://localhost:3000/.bzr`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/.env
  * Node Name: `http://localhost:3000/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/.git/config
  * Node Name: `http://localhost:3000/.git/config`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/.hg
  * Node Name: `http://localhost:3000/.hg`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/.htaccess
  * Node Name: `http://localhost:3000/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/.idea/WebServers.xml
  * Node Name: `http://localhost:3000/.idea/WebServers.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/.php_cs.cache
  * Node Name: `http://localhost:3000/.php_cs.cache`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/.ssh/id_dsa
  * Node Name: `http://localhost:3000/.ssh/id_dsa`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/.ssh/id_rsa
  * Node Name: `http://localhost:3000/.ssh/id_rsa`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/.svn/entries
  * Node Name: `http://localhost:3000/.svn/entries`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/.svn/wc.db
  * Node Name: `http://localhost:3000/.svn/wc.db`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/.zap513478983744788881
  * Node Name: `http://localhost:3000/.zap513478983744788881`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/5083114172785774382
  * Node Name: `http://localhost:3000/5083114172785774382`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/BitKeeper
  * Node Name: `http://localhost:3000/BitKeeper`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/CHANGELOG.txt
  * Node Name: `http://localhost:3000/CHANGELOG.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/CVS/root
  * Node Name: `http://localhost:3000/CVS/root`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/DEADJOE
  * Node Name: `http://localhost:3000/DEADJOE`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/FileZilla.xml
  * Node Name: `http://localhost:3000/FileZilla.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/WEB-INF/applicationContext.xml
  * Node Name: `http://localhost:3000/WEB-INF/applicationContext.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/WEB-INF/classes/40/292.class
  * Node Name: `http://localhost:3000/WEB-INF/classes/40/292.class`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/WEB-INF/classes/40/302.class
  * Node Name: `http://localhost:3000/WEB-INF/classes/40/302.class`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/WEB-INF/classes/applicationContext/xml.class
  * Node Name: `http://localhost:3000/WEB-INF/classes/applicationContext/xml.class`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/WEB-INF/classes/web/xml.class
  * Node Name: `http://localhost:3000/WEB-INF/classes/web/xml.class`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/WEB-INF/web.xml
  * Node Name: `http://localhost:3000/WEB-INF/web.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/WS_FTP.INI
  * Node Name: `http://localhost:3000/WS_FTP.INI`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/WS_FTP.ini
  * Node Name: `http://localhost:3000/WS_FTP.ini`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/WinSCP.ini
  * Node Name: `http://localhost:3000/WinSCP.ini`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/_framework/blazor.boot.json
  * Node Name: `http://localhost:3000/_framework/blazor.boot.json`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/_wpeprivate/config.json
  * Node Name: `http://localhost:3000/_wpeprivate/config.json`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/adminer.php
  * Node Name: `http://localhost:3000/adminer.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api
  * Node Name: `http://localhost:3000/api`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/
  * Node Name: `http://localhost:3000/api/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/.env
  * Node Name: `http://localhost:3000/api/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/.htaccess
  * Node Name: `http://localhost:3000/api/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/3540347101151040238
  * Node Name: `http://localhost:3000/api/3540347101151040238`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/trace.axd
  * Node Name: `http://localhost:3000/api/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/.env
  * Node Name: `http://localhost:3000/api/v1/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/.htaccess
  * Node Name: `http://localhost:3000/api/v1/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/2793978841337499034
  * Node Name: `http://localhost:3000/api/v1/2793978841337499034`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards
  * Node Name: `http://localhost:3000/api/v1/access-cards`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/access-cards (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards%3Fpage=1.2&limit=1.2&sourceBarangay=sourceBarangay&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/access-cards (class.module.classLoader.DefaultAssertio...,limit,page,sourceBarangay)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards%3Fpage=1.2&limit=1.2&sourceBarangay=sourceBarangay
  * Node Name: `http://localhost:3000/api/v1/access-cards (limit,page,sourceBarangay)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/
  * Node Name: `http://localhost:3000/api/v1/access-cards/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/.env
  * Node Name: `http://localhost:3000/api/v1/access-cards/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/.htaccess
  * Node Name: `http://localhost:3000/api/v1/access-cards/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/3988409730303185383
  * Node Name: `http://localhost:3000/api/v1/access-cards/3988409730303185383`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/.env
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/.htaccess
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/2987982528203883473
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/2987982528203883473`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/actuator/health
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/actuator/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/beneficiaryId%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/beneficiaryId (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/trace.axd
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/.env
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/.htaccess
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/74624808817855080
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/74624808817855080`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/.env
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/.htaccess
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/2437676591121277649
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/2437676591121277649`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/access-card-pdf
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/access-card-pdf`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/access-card-pdf%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/access-card-pdf (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/access-card-pdf/
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/access-card-pdf/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/.env
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/.htaccess
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/3510196040948967068
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/3510196040948967068`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary/
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/trace.axd
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/trace.axd
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/trace.axd
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/cardCode
  * Node Name: `http://localhost:3000/api/v1/access-cards/cardCode`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/cardCode%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/access-cards/cardCode (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/cardCode/
  * Node Name: `http://localhost:3000/api/v1/access-cards/cardCode/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code
  * Node Name: `http://localhost:3000/api/v1/access-cards/code`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/access-cards/code (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code/
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code/.env
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code/.htaccess
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code/6633162162571352506
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/6633162162571352506`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code/summary
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/summary`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code/summary%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/summary (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code/summary/
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/summary/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code/trace.axd
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/log%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/access-cards/log (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/trace.axd
  * Node Name: `http://localhost:3000/api/v1/access-cards/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies
  * Node Name: `http://localhost:3000/api/v1/agencies`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/agencies (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies/
  * Node Name: `http://localhost:3000/api/v1/agencies/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies/.env
  * Node Name: `http://localhost:3000/api/v1/agencies/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies/.htaccess
  * Node Name: `http://localhost:3000/api/v1/agencies/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies/241395007287070281
  * Node Name: `http://localhost:3000/api/v1/agencies/241395007287070281`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies/id
  * Node Name: `http://localhost:3000/api/v1/agencies/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/agencies/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies/id/
  * Node Name: `http://localhost:3000/api/v1/agencies/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies/trace.axd
  * Node Name: `http://localhost:3000/api/v1/agencies/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal
  * Node Name: `http://localhost:3000/api/v1/agency-portal`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/agency-portal (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/
  * Node Name: `http://localhost:3000/api/v1/agency-portal/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/.env
  * Node Name: `http://localhost:3000/api/v1/agency-portal/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/.htaccess
  * Node Name: `http://localhost:3000/api/v1/agency-portal/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/2534516706941279377
  * Node Name: `http://localhost:3000/api/v1/agency-portal/2534516706941279377`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/dashboard
  * Node Name: `http://localhost:3000/api/v1/agency-portal/dashboard`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/dashboard%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/agency-portal/dashboard (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/dashboard/
  * Node Name: `http://localhost:3000/api/v1/agency-portal/dashboard/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/profile
  * Node Name: `http://localhost:3000/api/v1/agency-portal/profile`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/profile%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/agency-portal/profile (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/profile/
  * Node Name: `http://localhost:3000/api/v1/agency-portal/profile/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/trace.axd
  * Node Name: `http://localhost:3000/api/v1/agency-portal/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements
  * Node Name: `http://localhost:3000/api/v1/announcements`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/announcements (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/
  * Node Name: `http://localhost:3000/api/v1/announcements/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/.env
  * Node Name: `http://localhost:3000/api/v1/announcements/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/.htaccess
  * Node Name: `http://localhost:3000/api/v1/announcements/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/59670007560951192
  * Node Name: `http://localhost:3000/api/v1/announcements/59670007560951192`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id
  * Node Name: `http://localhost:3000/api/v1/announcements/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/announcements/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/
  * Node Name: `http://localhost:3000/api/v1/announcements/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/.env
  * Node Name: `http://localhost:3000/api/v1/announcements/id/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/.htaccess
  * Node Name: `http://localhost:3000/api/v1/announcements/id/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/6957994171367525136
  * Node Name: `http://localhost:3000/api/v1/announcements/id/6957994171367525136`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/pin%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/announcements/id/pin (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/trace.axd
  * Node Name: `http://localhost:3000/api/v1/announcements/id/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/.env
  * Node Name: `http://localhost:3000/api/v1/announcements/public/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/.htaccess
  * Node Name: `http://localhost:3000/api/v1/announcements/public/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/5784488095344962862
  * Node Name: `http://localhost:3000/api/v1/announcements/public/5784488095344962862`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo/
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo/.env
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo/.htaccess
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo/3142881006169216428
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/3142881006169216428`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo/id
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo/id/
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo/trace.axd
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug/
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug/.env
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug/.htaccess
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug/7408747742283024693
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug/7408747742283024693`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug/photos
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug/photos`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug/photos%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug/photos (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug/photos/
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug/photos/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug/trace.axd
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/trace.axd
  * Node Name: `http://localhost:3000/api/v1/announcements/public/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/trace.axd
  * Node Name: `http://localhost:3000/api/v1/announcements/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit
  * Node Name: `http://localhost:3000/api/v1/audit`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/audit (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/
  * Node Name: `http://localhost:3000/api/v1/audit/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/.env
  * Node Name: `http://localhost:3000/api/v1/audit/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/.htaccess
  * Node Name: `http://localhost:3000/api/v1/audit/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/5232378382766066628
  * Node Name: `http://localhost:3000/api/v1/audit/5232378382766066628`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/coa-export%3FstartDate=startDate&endDate=endDate&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/audit/coa-export (class.module.classLoader.DefaultAssertio...,endDate,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/coa-export%3FstartDate=startDate&endDate=endDate
  * Node Name: `http://localhost:3000/api/v1/audit/coa-export (endDate,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/coa-export/
  * Node Name: `http://localhost:3000/api/v1/audit/coa-export/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/consent-ledger%3FbeneficiaryId=beneficiaryId&limit=limit&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/audit/consent-ledger (beneficiaryId,class.module.classLoader.DefaultAssertio...,limit)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/consent-ledger%3FbeneficiaryId=beneficiaryId&limit=limit
  * Node Name: `http://localhost:3000/api/v1/audit/consent-ledger (beneficiaryId,limit)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/consent-ledger/
  * Node Name: `http://localhost:3000/api/v1/audit/consent-ledger/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/logs%3Ftable=table&recordId=recordId&limit=1.2&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/audit/logs (class.module.classLoader.DefaultAssertio...,limit,recordId,table)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/logs%3Ftable=table&recordId=recordId&limit=1.2
  * Node Name: `http://localhost:3000/api/v1/audit/logs (limit,recordId,table)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/logs/
  * Node Name: `http://localhost:3000/api/v1/audit/logs/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/trace.axd
  * Node Name: `http://localhost:3000/api/v1/audit/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/verify-all
  * Node Name: `http://localhost:3000/api/v1/audit/verify-all`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/verify-all%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/audit/verify-all (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/verify-all/
  * Node Name: `http://localhost:3000/api/v1/audit/verify-all/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth
  * Node Name: `http://localhost:3000/api/v1/auth`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/auth (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/
  * Node Name: `http://localhost:3000/api/v1/auth/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/.env
  * Node Name: `http://localhost:3000/api/v1/auth/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/.htaccess
  * Node Name: `http://localhost:3000/api/v1/auth/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/3329775401498619425
  * Node Name: `http://localhost:3000/api/v1/auth/3329775401498619425`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/change-email%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/auth/change-email (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/change-password%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/auth/change-password (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login
  * Node Name: `http://localhost:3000/api/v1/auth/login`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/auth/login (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login/
  * Node Name: `http://localhost:3000/api/v1/auth/login/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login/.env
  * Node Name: `http://localhost:3000/api/v1/auth/login/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login/.htaccess
  * Node Name: `http://localhost:3000/api/v1/auth/login/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login/1393828315388478224
  * Node Name: `http://localhost:3000/api/v1/auth/login/1393828315388478224`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login/trace.axd
  * Node Name: `http://localhost:3000/api/v1/auth/login/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/me
  * Node Name: `http://localhost:3000/api/v1/auth/me`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/me%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/auth/me (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/me/
  * Node Name: `http://localhost:3000/api/v1/auth/me/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa
  * Node Name: `http://localhost:3000/api/v1/auth/mfa`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/auth/mfa (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/.env
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/.htaccess
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/8353834373111124819
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/8353834373111124819`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/disable%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/disable (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/enable%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/enable (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/setup%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/setup (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/trace.axd
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/trace.axd
  * Node Name: `http://localhost:3000/api/v1/auth/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/update-phone%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/auth/update-phone (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries
  * Node Name: `http://localhost:3000/api/v1/beneficiaries`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries%3Fbarangay=barangay&search=ZAP&page=page&limit=limit&category=category&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/beneficiaries (barangay,category,class.module.classLoader.DefaultAssertio...,limit,page,search)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries%3Fbarangay=barangay&search=ZAP&page=page&limit=limit&category=category
  * Node Name: `http://localhost:3000/api/v1/beneficiaries (barangay,category,limit,page,search)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/beneficiaries (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/.env
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/.htaccess
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/6806643684562352970
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/6806643684562352970`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/dashboard
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/dashboard`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/dashboard%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/dashboard (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/dashboard/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/dashboard/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/.env
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/.htaccess
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/5489409655941762922
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/5489409655941762922`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/.env
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/.htaccess
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/1114483916849801705
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/1114483916849801705`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/revoke%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/revoke (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/trace.axd
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/family-graph
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/family-graph`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/family-graph%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/family-graph (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/family-graph/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/family-graph/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household/.env
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household/.htaccess
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household/7799909443199525900
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household/7799909443199525900`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household/nhts-pr%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household/nhts-pr (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household/trace.axd
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/trace.axd
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/.env
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/.htaccess
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/36957591068021974
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/36957591068021974`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/access-card
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/access-card`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/access-card%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/access-card (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/access-card/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/access-card/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/consent
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/consent`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/consent%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/consent (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/consent/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/consent/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/services
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/services`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/services%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/services (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/services/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/services/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/trace.axd
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/trace.axd
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases
  * Node Name: `http://localhost:3000/api/v1/cases`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases%3Fpage=1.2&limit=1.2&status=status&search=ZAP&barangay=barangay&category=category&gender=gender&ageRange=ageRange&sla=sla&dateFrom=dateFrom&dateTo=dateTo&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases (ageRange,barangay,category,class.module.classLoader.DefaultAssertio...,dateFrom,dateTo,gender,limit,page,search,sla,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases%3Fpage=1.2&limit=1.2&status=status&search=ZAP&barangay=barangay&category=category&gender=gender&ageRange=ageRange&sla=sla&dateFrom=dateFrom&dateTo=dateTo
  * Node Name: `http://localhost:3000/api/v1/cases (ageRange,barangay,category,dateFrom,dateTo,gender,limit,page,search,sla,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/
  * Node Name: `http://localhost:3000/api/v1/cases/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/.env
  * Node Name: `http://localhost:3000/api/v1/cases/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/.htaccess
  * Node Name: `http://localhost:3000/api/v1/cases/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/9120529890614493669
  * Node Name: `http://localhost:3000/api/v1/cases/9120529890614493669`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/bulk-export%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/bulk-export (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId
  * Node Name: `http://localhost:3000/api/v1/cases/caseId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/caseId (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/.env
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/.htaccess
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/2526994127478847530
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/2526994127478847530`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/.env
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/.htaccess
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/1825450670109603601
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/1825450670109603601`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/trace.axd
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/trace.axd
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr
  * Node Name: `http://localhost:3000/api/v1/cases/csr`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/csr (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/
  * Node Name: `http://localhost:3000/api/v1/cases/csr/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/.env
  * Node Name: `http://localhost:3000/api/v1/cases/csr/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/.htaccess
  * Node Name: `http://localhost:3000/api/v1/cases/csr/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/8430554933081314609
  * Node Name: `http://localhost:3000/api/v1/cases/csr/8430554933081314609`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/.env
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/.htaccess
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/4374924177298994956
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/4374924177298994956`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/pdf
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/pdf`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/pdf%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/pdf (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/pdf/
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/pdf/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/trace.axd
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/trace.axd
  * Node Name: `http://localhost:3000/api/v1/cases/csr/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed/
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed/.env
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed/.htaccess
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed/6408426803953556457
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/6408426803953556457`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed/pending-intervention
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/pending-intervention`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed/pending-intervention%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/pending-intervention (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed/pending-intervention/
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/pending-intervention/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed/trace.axd
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id
  * Node Name: `http://localhost:3000/api/v1/cases/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/
  * Node Name: `http://localhost:3000/api/v1/cases/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/.env
  * Node Name: `http://localhost:3000/api/v1/cases/id/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/.htaccess
  * Node Name: `http://localhost:3000/api/v1/cases/id/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/648190916337239632
  * Node Name: `http://localhost:3000/api/v1/cases/id/648190916337239632`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/approve%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/approve (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/assessment%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/assessment (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/close%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/close (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/closure%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/closure (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/csr-pdf
  * Node Name: `http://localhost:3000/api/v1/cases/id/csr-pdf`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/csr-pdf%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/csr-pdf (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/csr-pdf/
  * Node Name: `http://localhost:3000/api/v1/cases/id/csr-pdf/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/disburse%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/disburse (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/documents%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/documents (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/gis-pdf
  * Node Name: `http://localhost:3000/api/v1/cases/id/gis-pdf`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/gis-pdf%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/gis-pdf (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/gis-pdf/
  * Node Name: `http://localhost:3000/api/v1/cases/id/gis-pdf/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/history
  * Node Name: `http://localhost:3000/api/v1/cases/id/history`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/history%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/history (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/history/
  * Node Name: `http://localhost:3000/api/v1/cases/id/history/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/issue-coe%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-coe (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/issue-pcv%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-pcv (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/override-status%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/override-status (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/referral-decision%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/referral-decision (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/request-review%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/request-review (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/requirements%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/requirements (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/status%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/status (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/trace.axd
  * Node Name: `http://localhost:3000/api/v1/cases/id/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/transition-plan%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/id/transition-plan (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/trace.axd
  * Node Name: `http://localhost:3000/api/v1/cases/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker
  * Node Name: `http://localhost:3000/api/v1/cases/tracker`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/tracker (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/.env
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/.htaccess
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/4305493571809738643
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/4305493571809738643`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/daily%3Fdate=date&status=status&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/daily (class.module.classLoader.DefaultAssertio...,date,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/daily%3Fdate=date&status=status
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/daily (date,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/daily/
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/daily/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/range%3Fstart=start&end=end&status=status&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/range (class.module.classLoader.DefaultAssertio...,end,start,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/range%3Fstart=start&end=end&status=status
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/range (end,start,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/range/
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/range/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/stats
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/stats`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/stats%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/stats (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/stats/
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/stats/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/trace.axd
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat
  * Node Name: `http://localhost:3000/api/v1/chat`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/chat (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/
  * Node Name: `http://localhost:3000/api/v1/chat/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/.env
  * Node Name: `http://localhost:3000/api/v1/chat/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/.htaccess
  * Node Name: `http://localhost:3000/api/v1/chat/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/5812444695417354501
  * Node Name: `http://localhost:3000/api/v1/chat/5812444695417354501`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation
  * Node Name: `http://localhost:3000/api/v1/chat/conversation`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/chat/conversation (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/.env
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/.htaccess
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/2911027844679525343
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/2911027844679525343`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId%3Flimit=limit&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId (class.module.classLoader.DefaultAssertio...,limit)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId%3Flimit=limit
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId (limit)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/.env
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/.htaccess
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/6116172029779585990
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/6116172029779585990`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/read%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/read (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/trace.axd
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/trace.axd
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversations
  * Node Name: `http://localhost:3000/api/v1/chat/conversations`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversations%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/chat/conversations (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversations/
  * Node Name: `http://localhost:3000/api/v1/chat/conversations/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/send%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/chat/send (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/trace.axd
  * Node Name: `http://localhost:3000/api/v1/chat/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/unread
  * Node Name: `http://localhost:3000/api/v1/chat/unread`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/unread%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/chat/unread (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/unread/
  * Node Name: `http://localhost:3000/api/v1/chat/unread/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/users
  * Node Name: `http://localhost:3000/api/v1/chat/users`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/users%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/chat/users (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/users/
  * Node Name: `http://localhost:3000/api/v1/chat/users/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages
  * Node Name: `http://localhost:3000/api/v1/contact-messages`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/contact-messages (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/
  * Node Name: `http://localhost:3000/api/v1/contact-messages/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/.env
  * Node Name: `http://localhost:3000/api/v1/contact-messages/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/.htaccess
  * Node Name: `http://localhost:3000/api/v1/contact-messages/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/5440850530359478863
  * Node Name: `http://localhost:3000/api/v1/contact-messages/5440850530359478863`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id/
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id/.env
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id/.htaccess
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id/4932479449205433883
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id/4932479449205433883`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id/read%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id/read (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id/trace.axd
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/trace.axd
  * Node Name: `http://localhost:3000/api/v1/contact-messages/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/unread-count
  * Node Name: `http://localhost:3000/api/v1/contact-messages/unread-count`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/unread-count%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/contact-messages/unread-count (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/unread-count/
  * Node Name: `http://localhost:3000/api/v1/contact-messages/unread-count/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr
  * Node Name: `http://localhost:3000/api/v1/csr`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/csr (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/
  * Node Name: `http://localhost:3000/api/v1/csr/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/.env
  * Node Name: `http://localhost:3000/api/v1/csr/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/.htaccess
  * Node Name: `http://localhost:3000/api/v1/csr/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/4891499962527608811
  * Node Name: `http://localhost:3000/api/v1/csr/4891499962527608811`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo/
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo/.env
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo/.htaccess
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo/6052107635935168339
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/6052107635935168339`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo/pdf
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/pdf`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo/pdf%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/pdf (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo/pdf/
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/pdf/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo/trace.axd
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/id
  * Node Name: `http://localhost:3000/api/v1/csr/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/csr/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/id/
  * Node Name: `http://localhost:3000/api/v1/csr/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/trace.axd
  * Node Name: `http://localhost:3000/api/v1/csr/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard
  * Node Name: `http://localhost:3000/api/v1/dashboard`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/dashboard (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/
  * Node Name: `http://localhost:3000/api/v1/dashboard/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/.env
  * Node Name: `http://localhost:3000/api/v1/dashboard/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/.htaccess
  * Node Name: `http://localhost:3000/api/v1/dashboard/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/2355196271361071306
  * Node Name: `http://localhost:3000/api/v1/dashboard/2355196271361071306`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-counts%3Fyear=year&month=month&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-counts (class.module.classLoader.DefaultAssertio...,month,year)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-counts%3Fyear=year&month=month
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-counts (month,year)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-counts/
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-counts/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-tracker%3Fdate=date&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-tracker (class.module.classLoader.DefaultAssertio...,date)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-tracker%3Fdate=date
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-tracker (date)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-tracker/
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-tracker/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/metrics%3Fbarangay=barangay
  * Node Name: `http://localhost:3000/api/v1/dashboard/metrics (barangay)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/metrics%3Fbarangay=barangay&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/dashboard/metrics (barangay,class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/metrics/
  * Node Name: `http://localhost:3000/api/v1/dashboard/metrics/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/.env
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/.htaccess
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/6768911071620155293
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/6768911071620155293`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/mayor%3FstartDate=2026-01-01&endDate=2026-12-31&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/mayor (class.module.classLoader.DefaultAssertio...,endDate,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/mayor%3FstartDate=2026-01-01&endDate=2026-12-31
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/mayor (endDate,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/mayor/
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/mayor/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/trace.axd
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/sla
  * Node Name: `http://localhost:3000/api/v1/dashboard/sla`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/sla%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/dashboard/sla (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/sla/
  * Node Name: `http://localhost:3000/api/v1/dashboard/sla/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/trace.axd
  * Node Name: `http://localhost:3000/api/v1/dashboard/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/trends%3Frange=1w&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/dashboard/trends (class.module.classLoader.DefaultAssertio...,range)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/trends%3Frange=1w
  * Node Name: `http://localhost:3000/api/v1/dashboard/trends (range)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/trends/
  * Node Name: `http://localhost:3000/api/v1/dashboard/trends/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export
  * Node Name: `http://localhost:3000/api/v1/export`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/export (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/
  * Node Name: `http://localhost:3000/api/v1/export/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/.env
  * Node Name: `http://localhost:3000/api/v1/export/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/.htaccess
  * Node Name: `http://localhost:3000/api/v1/export/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/5280828604415701391
  * Node Name: `http://localhost:3000/api/v1/export/5280828604415701391`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/audit-logs%3Fformat=pdf&startDate=startDate&endDate=endDate&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/export/audit-logs (class.module.classLoader.DefaultAssertio...,endDate,format,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/audit-logs%3Fformat=pdf&startDate=startDate&endDate=endDate
  * Node Name: `http://localhost:3000/api/v1/export/audit-logs (endDate,format,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/audit-logs/
  * Node Name: `http://localhost:3000/api/v1/export/audit-logs/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/certificate%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/export/certificate (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/compliance%3Fformat=pdf&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/export/compliance (class.module.classLoader.DefaultAssertio...,format)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/compliance%3Fformat=pdf
  * Node Name: `http://localhost:3000/api/v1/export/compliance (format)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/compliance/
  * Node Name: `http://localhost:3000/api/v1/export/compliance/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/monthly-funds%3Fmonth=2026-08&startDate=2026-01-01&endDate=2026-12-31&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/export/monthly-funds (class.module.classLoader.DefaultAssertio...,endDate,month,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/monthly-funds%3Fmonth=2026-08&startDate=2026-01-01&endDate=2026-12-31
  * Node Name: `http://localhost:3000/api/v1/export/monthly-funds (endDate,month,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/monthly-funds/
  * Node Name: `http://localhost:3000/api/v1/export/monthly-funds/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/service-summary%3Fformat=pdf&startDate=startDate&endDate=endDate&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/export/service-summary (class.module.classLoader.DefaultAssertio...,endDate,format,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/service-summary%3Fformat=pdf&startDate=startDate&endDate=endDate
  * Node Name: `http://localhost:3000/api/v1/export/service-summary (endDate,format,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/service-summary/
  * Node Name: `http://localhost:3000/api/v1/export/service-summary/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/trace.axd
  * Node Name: `http://localhost:3000/api/v1/export/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing
  * Node Name: `http://localhost:3000/api/v1/filing`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing%3FcaseId=caseId&beneficiaryId=beneficiaryId&requirementKey=requirementKey&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing (beneficiaryId,caseId,class.module.classLoader.DefaultAssertio...,requirementKey)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing%3FcaseId=caseId&beneficiaryId=beneficiaryId&requirementKey=requirementKey
  * Node Name: `http://localhost:3000/api/v1/filing (beneficiaryId,caseId,requirementKey)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/
  * Node Name: `http://localhost:3000/api/v1/filing/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/.env
  * Node Name: `http://localhost:3000/api/v1/filing/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/.htaccess
  * Node Name: `http://localhost:3000/api/v1/filing/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/8703581984940150946
  * Node Name: `http://localhost:3000/api/v1/filing/8703581984940150946`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements
  * Node Name: `http://localhost:3000/api/v1/filing/announcements`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing/announcements (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/.env
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/.htaccess
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/1671487602131288991
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/1671487602131288991`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/.env
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/.htaccess
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/3937239434851646102
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/3937239434851646102`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/photos
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/photos`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/photos%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/photos (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/photos/
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/photos/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/trace.axd
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/trace.axd
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case
  * Node Name: `http://localhost:3000/api/v1/filing/case`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing/case (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/
  * Node Name: `http://localhost:3000/api/v1/filing/case/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/.env
  * Node Name: `http://localhost:3000/api/v1/filing/case/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/.htaccess
  * Node Name: `http://localhost:3000/api/v1/filing/case/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/1755833945513329551
  * Node Name: `http://localhost:3000/api/v1/filing/case/1755833945513329551`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId/
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId/.env
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId/.htaccess
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId/7644762361355370486
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/7644762361355370486`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId/id-photo
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/id-photo`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId/id-photo%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/id-photo (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId/id-photo/
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/id-photo/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId/trace.axd
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/trace.axd
  * Node Name: `http://localhost:3000/api/v1/filing/case/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/cleanup%3Fdays=days&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing/cleanup (class.module.classLoader.DefaultAssertio...,days)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id
  * Node Name: `http://localhost:3000/api/v1/filing/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id/
  * Node Name: `http://localhost:3000/api/v1/filing/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id/.env
  * Node Name: `http://localhost:3000/api/v1/filing/id/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id/.htaccess
  * Node Name: `http://localhost:3000/api/v1/filing/id/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id/1899838754507576415
  * Node Name: `http://localhost:3000/api/v1/filing/id/1899838754507576415`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id/download
  * Node Name: `http://localhost:3000/api/v1/filing/id/download`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id/download%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing/id/download (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id/download/
  * Node Name: `http://localhost:3000/api/v1/filing/id/download/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id/trace.axd
  * Node Name: `http://localhost:3000/api/v1/filing/id/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf
  * Node Name: `http://localhost:3000/api/v1/filing/irf`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing/irf (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/
  * Node Name: `http://localhost:3000/api/v1/filing/irf/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/.env
  * Node Name: `http://localhost:3000/api/v1/filing/irf/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/.htaccess
  * Node Name: `http://localhost:3000/api/v1/filing/irf/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/2847300145659031996
  * Node Name: `http://localhost:3000/api/v1/filing/irf/2847300145659031996`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId/
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId/.env
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId/.htaccess
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId/5811973378382849756
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/5811973378382849756`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId/photos
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/photos`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId/photos%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/photos (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId/photos/
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/photos/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId/trace.axd
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/trace.axd
  * Node Name: `http://localhost:3000/api/v1/filing/irf/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/trace.axd
  * Node Name: `http://localhost:3000/api/v1/filing/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/upload%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/filing/upload (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps
  * Node Name: `http://localhost:3000/api/v1/fourps`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/fourps (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/
  * Node Name: `http://localhost:3000/api/v1/fourps/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/.env
  * Node Name: `http://localhost:3000/api/v1/fourps/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/.htaccess
  * Node Name: `http://localhost:3000/api/v1/fourps/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/6583285427546124150
  * Node Name: `http://localhost:3000/api/v1/fourps/6583285427546124150`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/.env
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/.htaccess
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/2671465114683695729
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/2671465114683695729`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/compliance
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/compliance`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/compliance%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/compliance (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/compliance/
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/compliance/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/generate-compliance%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/generate-compliance (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/payouts
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/payouts`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/payouts%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/payouts (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/payouts/
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/payouts/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/trace.axd
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/.env
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/.htaccess
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/2408946407127307359
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/2408946407127307359`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/.env
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/.htaccess
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/4051564516071143996
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/4051564516071143996`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/meet%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/meet (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/trace.axd
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/trace.axd
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/.env
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/.htaccess
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/92630248330924656
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/92630248330924656`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/.env
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/.htaccess
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/2060414750404531747
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/2060414750404531747`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/notify%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/notify (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/status%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/status (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/trace.axd
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/trace.axd
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/trace.axd
  * Node Name: `http://localhost:3000/api/v1/fourps/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health/.env
  * Node Name: `http://localhost:3000/api/v1/health/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health/.htaccess
  * Node Name: `http://localhost:3000/api/v1/health/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health/1255275990845322665
  * Node Name: `http://localhost:3000/api/v1/health/1255275990845322665`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health/trace.axd
  * Node Name: `http://localhost:3000/api/v1/health/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake
  * Node Name: `http://localhost:3000/api/v1/intake`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/intake (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/
  * Node Name: `http://localhost:3000/api/v1/intake/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/.env
  * Node Name: `http://localhost:3000/api/v1/intake/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/.htaccess
  * Node Name: `http://localhost:3000/api/v1/intake/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/3946814906837578662
  * Node Name: `http://localhost:3000/api/v1/intake/3946814906837578662`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm
  * Node Name: `http://localhost:3000/api/v1/intake/confirm`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/intake/confirm (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm/
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm/.env
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm/.htaccess
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm/6205173141943883977
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/6205173141943883977`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm/householdId%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/householdId (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm/trace.axd
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/match-check%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/intake/match-check (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/trace.axd
  * Node Name: `http://localhost:3000/api/v1/intake/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/.env
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/.htaccess
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/5898500115288131117
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/5898500115288131117`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search%3Fq=q&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search (class.module.classLoader.DefaultAssertio...,q)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search%3Fq=q
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search (q)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case/.env
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case/.htaccess
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case/6314096689972725214
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case/6314096689972725214`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case/caseId
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case/caseId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case/caseId%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case/caseId (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case/caseId/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case/caseId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case/trace.axd
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/.env
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/.htaccess
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/2244259457981682765
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/2244259457981682765`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/action%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/action (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/close%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/close (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/decline%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/decline (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/receive%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/receive (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/trace.axd
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/inbox
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/inbox`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/inbox%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/inbox (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/inbox/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/inbox/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/.env
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/.htaccess
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/7074449160001990313
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/7074449160001990313`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/.env
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/.htaccess
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/991340903657691175
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/991340903657691175`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/trace.axd
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/trace.axd
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/trace.axd
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf
  * Node Name: `http://localhost:3000/api/v1/irf`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf%3Fpage=1.2&limit=1.2&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf (class.module.classLoader.DefaultAssertio...,limit,page)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf%3Fpage=1.2&limit=1.2
  * Node Name: `http://localhost:3000/api/v1/irf (limit,page)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/
  * Node Name: `http://localhost:3000/api/v1/irf/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/.env
  * Node Name: `http://localhost:3000/api/v1/irf/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/.htaccess
  * Node Name: `http://localhost:3000/api/v1/irf/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/1080817487555705028
  * Node Name: `http://localhost:3000/api/v1/irf/1080817487555705028`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case
  * Node Name: `http://localhost:3000/api/v1/irf/by-case`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/by-case (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case/
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case/.env
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case/.htaccess
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case/4932505469922770418
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/4932505469922770418`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case/caseId
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/caseId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case/caseId%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/caseId (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case/caseId/
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/caseId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case/trace.axd
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id
  * Node Name: `http://localhost:3000/api/v1/irf/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/
  * Node Name: `http://localhost:3000/api/v1/irf/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/.env
  * Node Name: `http://localhost:3000/api/v1/irf/id/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/.htaccess
  * Node Name: `http://localhost:3000/api/v1/irf/id/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/5851269169091773722
  * Node Name: `http://localhost:3000/api/v1/irf/id/5851269169091773722`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/close%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/id/close (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/decrypt%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/id/decrypt (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/dismiss%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/id/dismiss (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-json%3FlegalBasis=legalBasis&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-json (class.module.classLoader.DefaultAssertio...,legalBasis)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-json%3FlegalBasis=legalBasis
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-json (legalBasis)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-json/
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-json/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-pdf%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-pdf (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-wcpd%3FlegalBasis=legalBasis&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-wcpd (class.module.classLoader.DefaultAssertio...,legalBasis)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-wcpd%3FlegalBasis=legalBasis
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-wcpd (legalBasis)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-wcpd/
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-wcpd/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/narration%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/id/narration (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/override-disposition%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/id/override-disposition (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/refer-pnp%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/id/refer-pnp (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/refer-wcpd%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/id/refer-wcpd (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/trace.axd
  * Node Name: `http://localhost:3000/api/v1/irf/id/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/unmask-names%3FlegalBasis=legalBasis&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/irf/id/unmask-names (class.module.classLoader.DefaultAssertio...,legalBasis)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/unmask-names%3FlegalBasis=legalBasis
  * Node Name: `http://localhost:3000/api/v1/irf/id/unmask-names (legalBasis)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/unmask-names/
  * Node Name: `http://localhost:3000/api/v1/irf/id/unmask-names/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/trace.axd
  * Node Name: `http://localhost:3000/api/v1/irf/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr
  * Node Name: `http://localhost:3000/api/v1/lcr`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/lcr (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/
  * Node Name: `http://localhost:3000/api/v1/lcr/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/.env
  * Node Name: `http://localhost:3000/api/v1/lcr/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/.htaccess
  * Node Name: `http://localhost:3000/api/v1/lcr/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/6102555745782858092
  * Node Name: `http://localhost:3000/api/v1/lcr/6102555745782858092`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/import%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/lcr/import (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/import-batch%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/lcr/import-batch (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/trace.axd
  * Node Name: `http://localhost:3000/api/v1/lcr/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio
  * Node Name: `http://localhost:3000/api/v1/minio`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/minio (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/
  * Node Name: `http://localhost:3000/api/v1/minio/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/.env
  * Node Name: `http://localhost:3000/api/v1/minio/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/.htaccess
  * Node Name: `http://localhost:3000/api/v1/minio/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/3794591324674968166
  * Node Name: `http://localhost:3000/api/v1/minio/3794591324674968166`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/.env
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/.htaccess
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/8104773823837288421
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/8104773823837288421`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/.env
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/.htaccess
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/4636594301885965059
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/4636594301885965059`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/fileName
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/fileName`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/fileName%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/fileName (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/fileName/
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/fileName/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/trace.axd
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/trace.axd
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/trace.axd
  * Node Name: `http://localhost:3000/api/v1/minio/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/upload%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/minio/upload (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications
  * Node Name: `http://localhost:3000/api/v1/notifications`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/notifications (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/
  * Node Name: `http://localhost:3000/api/v1/notifications/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/.env
  * Node Name: `http://localhost:3000/api/v1/notifications/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/.htaccess
  * Node Name: `http://localhost:3000/api/v1/notifications/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/2205425458693129540
  * Node Name: `http://localhost:3000/api/v1/notifications/2205425458693129540`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id
  * Node Name: `http://localhost:3000/api/v1/notifications/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/notifications/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/
  * Node Name: `http://localhost:3000/api/v1/notifications/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/.env
  * Node Name: `http://localhost:3000/api/v1/notifications/id/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/.htaccess
  * Node Name: `http://localhost:3000/api/v1/notifications/id/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/8330881771403166415
  * Node Name: `http://localhost:3000/api/v1/notifications/id/8330881771403166415`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/read%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/notifications/id/read (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/send%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/notifications/id/send (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/send-with-consent%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/notifications/id/send-with-consent (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/trace.axd
  * Node Name: `http://localhost:3000/api/v1/notifications/id/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/my
  * Node Name: `http://localhost:3000/api/v1/notifications/my`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/my%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/notifications/my (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/my/
  * Node Name: `http://localhost:3000/api/v1/notifications/my/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/.env
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/.htaccess
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/8633919183329019510
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/8633919183329019510`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/bulk%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/bulk (class.module.classLoader.DefaultAssertio...)([])`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/trace.axd
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/read-all%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/notifications/read-all (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient/
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient/.env
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient/.htaccess
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient/4520321956459068588
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/4520321956459068588`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient/recipientId
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/recipientId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient/recipientId%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/recipientId (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient/recipientId/
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/recipientId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient/trace.axd
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/trace.axd
  * Node Name: `http://localhost:3000/api/v1/notifications/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/unread
  * Node Name: `http://localhost:3000/api/v1/notifications/unread`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/unread%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/notifications/unread (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/unread/
  * Node Name: `http://localhost:3000/api/v1/notifications/unread/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs
  * Node Name: `http://localhost:3000/api/v1/programs`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs%3FactiveOnly=activeOnly
  * Node Name: `http://localhost:3000/api/v1/programs (activeOnly)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs%3FactiveOnly=activeOnly&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/programs (activeOnly,class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/programs (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/
  * Node Name: `http://localhost:3000/api/v1/programs/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/.env
  * Node Name: `http://localhost:3000/api/v1/programs/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/.htaccess
  * Node Name: `http://localhost:3000/api/v1/programs/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/3970780946200934212
  * Node Name: `http://localhost:3000/api/v1/programs/3970780946200934212`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/id
  * Node Name: `http://localhost:3000/api/v1/programs/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/programs/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/id/
  * Node Name: `http://localhost:3000/api/v1/programs/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public/.env
  * Node Name: `http://localhost:3000/api/v1/programs/public/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public/.htaccess
  * Node Name: `http://localhost:3000/api/v1/programs/public/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public/3841446476803165550
  * Node Name: `http://localhost:3000/api/v1/programs/public/3841446476803165550`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public/id
  * Node Name: `http://localhost:3000/api/v1/programs/public/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public/id/
  * Node Name: `http://localhost:3000/api/v1/programs/public/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public/trace.axd
  * Node Name: `http://localhost:3000/api/v1/programs/public/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/trace.axd
  * Node Name: `http://localhost:3000/api/v1/programs/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals
  * Node Name: `http://localhost:3000/api/v1/referrals`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals%3Fbarangay=barangay&status=status&intakePending=intakePending&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/referrals (barangay,class.module.classLoader.DefaultAssertio...,intakePending,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals%3Fbarangay=barangay&status=status&intakePending=intakePending
  * Node Name: `http://localhost:3000/api/v1/referrals (barangay,intakePending,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/referrals (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/
  * Node Name: `http://localhost:3000/api/v1/referrals/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/.env
  * Node Name: `http://localhost:3000/api/v1/referrals/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/.htaccess
  * Node Name: `http://localhost:3000/api/v1/referrals/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/4500963375187680123
  * Node Name: `http://localhost:3000/api/v1/referrals/4500963375187680123`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/counts
  * Node Name: `http://localhost:3000/api/v1/referrals/counts`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/counts%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/referrals/counts (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/counts/
  * Node Name: `http://localhost:3000/api/v1/referrals/counts/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id
  * Node Name: `http://localhost:3000/api/v1/referrals/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/referrals/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/
  * Node Name: `http://localhost:3000/api/v1/referrals/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/.env
  * Node Name: `http://localhost:3000/api/v1/referrals/id/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/.htaccess
  * Node Name: `http://localhost:3000/api/v1/referrals/id/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/2696418923732349322
  * Node Name: `http://localhost:3000/api/v1/referrals/id/2696418923732349322`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/accept%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/referrals/id/accept (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/decline%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/referrals/id/decline (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/trace.axd
  * Node Name: `http://localhost:3000/api/v1/referrals/id/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/mine
  * Node Name: `http://localhost:3000/api/v1/referrals/mine`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/mine%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/referrals/mine (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/mine/
  * Node Name: `http://localhost:3000/api/v1/referrals/mine/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/pending-count%3Fbarangay=barangay
  * Node Name: `http://localhost:3000/api/v1/referrals/pending-count (barangay)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/pending-count%3Fbarangay=barangay&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/referrals/pending-count (barangay,class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/pending-count/
  * Node Name: `http://localhost:3000/api/v1/referrals/pending-count/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/trace.axd
  * Node Name: `http://localhost:3000/api/v1/referrals/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla
  * Node Name: `http://localhost:3000/api/v1/sla`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/sla (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla/
  * Node Name: `http://localhost:3000/api/v1/sla/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla/.env
  * Node Name: `http://localhost:3000/api/v1/sla/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla/.htaccess
  * Node Name: `http://localhost:3000/api/v1/sla/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla/5227372612118637452
  * Node Name: `http://localhost:3000/api/v1/sla/5227372612118637452`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla/check%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/sla/check (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla/trace.axd
  * Node Name: `http://localhost:3000/api/v1/sla/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync
  * Node Name: `http://localhost:3000/api/v1/sync`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/sync (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/
  * Node Name: `http://localhost:3000/api/v1/sync/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/.env
  * Node Name: `http://localhost:3000/api/v1/sync/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/.htaccess
  * Node Name: `http://localhost:3000/api/v1/sync/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/292951934886052029
  * Node Name: `http://localhost:3000/api/v1/sync/292951934886052029`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/.env
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/.htaccess
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/762020714347646846
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/762020714347646846`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/deviceId
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/deviceId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/deviceId%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/deviceId (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/deviceId/
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/deviceId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id/
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id/.env
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id/.htaccess
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id/3599020211392681949
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/3599020211392681949`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id/resolve%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/resolve (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id/trace.axd
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/trace.axd
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/pull%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/sync/pull (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/trace.axd
  * Node Name: `http://localhost:3000/api/v1/sync/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/v1%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/sync/v1 (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/trace.axd
  * Node Name: `http://localhost:3000/api/v1/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users
  * Node Name: `http://localhost:3000/api/v1/users`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/users (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users%3Fsearch=ZAP&role=role&status=status&page=page&limit=limit&class.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/users (class.module.classLoader.DefaultAssertio...,limit,page,role,search,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users%3Fsearch=ZAP&role=role&status=status&page=page&limit=limit
  * Node Name: `http://localhost:3000/api/v1/users (limit,page,role,search,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/
  * Node Name: `http://localhost:3000/api/v1/users/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/.env
  * Node Name: `http://localhost:3000/api/v1/users/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/.htaccess
  * Node Name: `http://localhost:3000/api/v1/users/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/8633962751035986895
  * Node Name: `http://localhost:3000/api/v1/users/8633962751035986895`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/id
  * Node Name: `http://localhost:3000/api/v1/users/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/id%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:3000/api/v1/users/id (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/id/
  * Node Name: `http://localhost:3000/api/v1/users/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/trace.axd
  * Node Name: `http://localhost:3000/api/v1/users/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/app/etc/local.xml
  * Node Name: `http://localhost:3000/app/etc/local.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/composer.json
  * Node Name: `http://localhost:3000/composer.json`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/composer.lock
  * Node Name: `http://localhost:3000/composer.lock`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/config/database.yml
  * Node Name: `http://localhost:3000/config/database.yml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/config/databases.yml
  * Node Name: `http://localhost:3000/config/databases.yml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/core
  * Node Name: `http://localhost:3000/core`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/elmah.axd
  * Node Name: `http://localhost:3000/elmah.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/filezilla.xml
  * Node Name: `http://localhost:3000/filezilla.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/i.php
  * Node Name: `http://localhost:3000/i.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/id_dsa
  * Node Name: `http://localhost:3000/id_dsa`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/id_rsa
  * Node Name: `http://localhost:3000/id_rsa`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/info.php
  * Node Name: `http://localhost:3000/info.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/key.pem
  * Node Name: `http://localhost:3000/key.pem`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/lfm.php
  * Node Name: `http://localhost:3000/lfm.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/myserver.key
  * Node Name: `http://localhost:3000/myserver.key`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/phpinfo.php
  * Node Name: `http://localhost:3000/phpinfo.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/privatekey.key
  * Node Name: `http://localhost:3000/privatekey.key`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/server-info
  * Node Name: `http://localhost:3000/server-info`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/server-status
  * Node Name: `http://localhost:3000/server-status`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/server.key
  * Node Name: `http://localhost:3000/server.key`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/sftp-config.json
  * Node Name: `http://localhost:3000/sftp-config.json`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/sitemanager.xml
  * Node Name: `http://localhost:3000/sitemanager.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/sites/default/files/.ht.sqlite
  * Node Name: `http://localhost:3000/sites/default/files/.ht.sqlite`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/sites/default/private/files/backup_migrate/scheduled/test.txt
  * Node Name: `http://localhost:3000/sites/default/private/files/backup_migrate/scheduled/test.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/test.php
  * Node Name: `http://localhost:3000/test.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/trace.axd
  * Node Name: `http://localhost:3000/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/vb_test.php
  * Node Name: `http://localhost:3000/vb_test.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/vim_settings.xml
  * Node Name: `http://localhost:3000/vim_settings.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/winscp.ini
  * Node Name: `http://localhost:3000/winscp.ini`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/ws_ftp.ini
  * Node Name: `http://localhost:3000/ws_ftp.ini`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/zap1405376763434187040
  * Node Name: `http://localhost:3000/zap1405376763434187040`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id
  * Node Name: `http://localhost:3000/api/v1/announcements/id`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/
  * Node Name: `http://localhost:3000/api/v1/announcements/id/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/pin
  * Node Name: `http://localhost:3000/api/v1/announcements/id/pin`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/pin/
  * Node Name: `http://localhost:3000/api/v1/announcements/id/pin/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household/nhts-pr
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household/nhts-pr`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household/nhts-pr/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household/nhts-pr/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/id
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/id`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/id/
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/id/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/approve
  * Node Name: `http://localhost:3000/api/v1/cases/id/approve`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/approve/
  * Node Name: `http://localhost:3000/api/v1/cases/id/approve/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/assessment
  * Node Name: `http://localhost:3000/api/v1/cases/id/assessment`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/assessment/
  * Node Name: `http://localhost:3000/api/v1/cases/id/assessment/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/close
  * Node Name: `http://localhost:3000/api/v1/cases/id/close`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/close/
  * Node Name: `http://localhost:3000/api/v1/cases/id/close/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/closure
  * Node Name: `http://localhost:3000/api/v1/cases/id/closure`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/closure/
  * Node Name: `http://localhost:3000/api/v1/cases/id/closure/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/disburse
  * Node Name: `http://localhost:3000/api/v1/cases/id/disburse`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/disburse/
  * Node Name: `http://localhost:3000/api/v1/cases/id/disburse/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/documents
  * Node Name: `http://localhost:3000/api/v1/cases/id/documents`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/documents/
  * Node Name: `http://localhost:3000/api/v1/cases/id/documents/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/override-status
  * Node Name: `http://localhost:3000/api/v1/cases/id/override-status`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/override-status/
  * Node Name: `http://localhost:3000/api/v1/cases/id/override-status/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/referral-decision
  * Node Name: `http://localhost:3000/api/v1/cases/id/referral-decision`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/referral-decision/
  * Node Name: `http://localhost:3000/api/v1/cases/id/referral-decision/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/request-review
  * Node Name: `http://localhost:3000/api/v1/cases/id/request-review`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/request-review/
  * Node Name: `http://localhost:3000/api/v1/cases/id/request-review/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/requirements
  * Node Name: `http://localhost:3000/api/v1/cases/id/requirements`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/requirements/
  * Node Name: `http://localhost:3000/api/v1/cases/id/requirements/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/status
  * Node Name: `http://localhost:3000/api/v1/cases/id/status`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/status/
  * Node Name: `http://localhost:3000/api/v1/cases/id/status/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/transition-plan
  * Node Name: `http://localhost:3000/api/v1/cases/id/transition-plan`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/transition-plan/
  * Node Name: `http://localhost:3000/api/v1/cases/id/transition-plan/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id/read
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id/read`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id/read/
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id/read/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/id
  * Node Name: `http://localhost:3000/api/v1/csr/id`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/id/
  * Node Name: `http://localhost:3000/api/v1/csr/id/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/meet
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/meet`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/meet/
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/meet/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/status
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/status`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/status/
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/status/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/action
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/action`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/action/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/action/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/close
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/close`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/close/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/close/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/decline
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/decline`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/decline/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/decline/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/receive
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/receive`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/receive/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/receive/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/close
  * Node Name: `http://localhost:3000/api/v1/irf/id/close`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/close/
  * Node Name: `http://localhost:3000/api/v1/irf/id/close/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/dismiss
  * Node Name: `http://localhost:3000/api/v1/irf/id/dismiss`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/dismiss/
  * Node Name: `http://localhost:3000/api/v1/irf/id/dismiss/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/narration
  * Node Name: `http://localhost:3000/api/v1/irf/id/narration`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/narration/
  * Node Name: `http://localhost:3000/api/v1/irf/id/narration/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/override-disposition
  * Node Name: `http://localhost:3000/api/v1/irf/id/override-disposition`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/override-disposition/
  * Node Name: `http://localhost:3000/api/v1/irf/id/override-disposition/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/refer-pnp
  * Node Name: `http://localhost:3000/api/v1/irf/id/refer-pnp`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/refer-pnp/
  * Node Name: `http://localhost:3000/api/v1/irf/id/refer-pnp/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/refer-wcpd
  * Node Name: `http://localhost:3000/api/v1/irf/id/refer-wcpd`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/refer-wcpd/
  * Node Name: `http://localhost:3000/api/v1/irf/id/refer-wcpd/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/id
  * Node Name: `http://localhost:3000/api/v1/programs/id`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/id/
  * Node Name: `http://localhost:3000/api/v1/programs/id/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/accept
  * Node Name: `http://localhost:3000/api/v1/referrals/id/accept`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/accept/
  * Node Name: `http://localhost:3000/api/v1/referrals/id/accept/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/decline
  * Node Name: `http://localhost:3000/api/v1/referrals/id/decline`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/decline/
  * Node Name: `http://localhost:3000/api/v1/referrals/id/decline/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/id
  * Node Name: `http://localhost:3000/api/v1/users/id`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/id/
  * Node Name: `http://localhost:3000/api/v1/users/id/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000
  * Node Name: `http://localhost:3000 ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/ (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/ (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api
  * Node Name: `http://localhost:3000/api ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/docs-json
  * Node Name: `http://localhost:3000/api/docs-json ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/docs-json%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/docs-json (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/docs-json%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/docs-json (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1
  * Node Name: `http://localhost:3000/api/v1 ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1 (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1 (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards
  * Node Name: `http://localhost:3000/api/v1/access-cards ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards%3Fpage=1.2&limit=1.2&sourceBarangay=sourceBarangay
  * Node Name: `http://localhost:3000/api/v1/access-cards (limit,page,sourceBarangay)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/beneficiaryId
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/beneficiaryId`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/beneficiaryId
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/beneficiaryId ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/beneficiaryId
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/beneficiaryId ()(multipart:1,0)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/beneficiaryId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/beneficiaryId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/beneficiaryId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/beneficiaryId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/beneficiaryId/
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/beneficiaryId/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/access-card-pdf
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/access-card-pdf ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/access-card-pdf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/access-card-pdf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/access-card-pdf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/access-card-pdf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/cardCode
  * Node Name: `http://localhost:3000/api/v1/access-cards/cardCode ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/cardCode%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/cardCode (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/cardCode%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/cardCode (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code
  * Node Name: `http://localhost:3000/api/v1/access-cards/code ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/code (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/code (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code/summary
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/summary ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code/summary%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/summary (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code/summary%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/summary (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/log
  * Node Name: `http://localhost:3000/api/v1/access-cards/log`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/log
  * Node Name: `http://localhost:3000/api/v1/access-cards/log ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/log%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/log (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/log%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/access-cards/log (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/log/
  * Node Name: `http://localhost:3000/api/v1/access-cards/log/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies
  * Node Name: `http://localhost:3000/api/v1/agencies`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies
  * Node Name: `http://localhost:3000/api/v1/agencies ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/agencies (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/agencies (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies/
  * Node Name: `http://localhost:3000/api/v1/agencies/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies/id
  * Node Name: `http://localhost:3000/api/v1/agencies/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/agencies/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/agencies/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal
  * Node Name: `http://localhost:3000/api/v1/agency-portal ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/agency-portal (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/agency-portal (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/dashboard
  * Node Name: `http://localhost:3000/api/v1/agency-portal/dashboard ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/dashboard%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/agency-portal/dashboard (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/dashboard%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/agency-portal/dashboard (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/profile
  * Node Name: `http://localhost:3000/api/v1/agency-portal/profile ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/profile%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/agency-portal/profile (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/profile%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/agency-portal/profile (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements
  * Node Name: `http://localhost:3000/api/v1/announcements`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements
  * Node Name: `http://localhost:3000/api/v1/announcements ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/
  * Node Name: `http://localhost:3000/api/v1/announcements/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id
  * Node Name: `http://localhost:3000/api/v1/announcements/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/pin
  * Node Name: `http://localhost:3000/api/v1/announcements/id/pin ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/pin%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/id/pin (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/pin%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/id/pin (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public
  * Node Name: `http://localhost:3000/api/v1/announcements/public ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/public (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/public (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug/photos
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug/photos ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug/photos%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug/photos (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug/photos%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug/photos (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit
  * Node Name: `http://localhost:3000/api/v1/audit ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/audit (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/audit (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/coa-export%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/audit/coa-export (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/coa-export%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/audit/coa-export (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/coa-export%3FstartDate=startDate&endDate=endDate
  * Node Name: `http://localhost:3000/api/v1/audit/coa-export (endDate,startDate)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/consent-ledger%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/audit/consent-ledger (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/consent-ledger%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/audit/consent-ledger (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/consent-ledger%3FbeneficiaryId=beneficiaryId&limit=limit
  * Node Name: `http://localhost:3000/api/v1/audit/consent-ledger (beneficiaryId,limit)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/logs%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/audit/logs (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/logs%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/audit/logs (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/logs%3Ftable=table&recordId=recordId&limit=1.2
  * Node Name: `http://localhost:3000/api/v1/audit/logs (limit,recordId,table)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/verify-all
  * Node Name: `http://localhost:3000/api/v1/audit/verify-all ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/verify-all%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/audit/verify-all (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/verify-all%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/audit/verify-all (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth
  * Node Name: `http://localhost:3000/api/v1/auth ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/change-email
  * Node Name: `http://localhost:3000/api/v1/auth/change-email`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/change-email
  * Node Name: `http://localhost:3000/api/v1/auth/change-email ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/change-email%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/change-email (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/change-email%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/change-email (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/change-email/
  * Node Name: `http://localhost:3000/api/v1/auth/change-email/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/change-password
  * Node Name: `http://localhost:3000/api/v1/auth/change-password`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/change-password
  * Node Name: `http://localhost:3000/api/v1/auth/change-password ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/change-password%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/change-password (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/change-password%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/change-password (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/change-password/
  * Node Name: `http://localhost:3000/api/v1/auth/change-password/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/confirm-email-change
  * Node Name: `http://localhost:3000/api/v1/auth/confirm-email-change`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/confirm-email-change%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/confirm-email-change (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/confirm-email-change%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/confirm-email-change (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/confirm-email-change/
  * Node Name: `http://localhost:3000/api/v1/auth/confirm-email-change/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/forgot-password
  * Node Name: `http://localhost:3000/api/v1/auth/forgot-password`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/forgot-password%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/forgot-password (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/forgot-password%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/forgot-password (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/forgot-password/
  * Node Name: `http://localhost:3000/api/v1/auth/forgot-password/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login
  * Node Name: `http://localhost:3000/api/v1/auth/login`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login
  * Node Name: `http://localhost:3000/api/v1/auth/login ()(aaa)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login
  * Node Name: `http://localhost:3000/api/v1/auth/login ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/login (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/login (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login/
  * Node Name: `http://localhost:3000/api/v1/auth/login/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login/otp-verify
  * Node Name: `http://localhost:3000/api/v1/auth/login/otp-verify`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login/otp-verify%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/login/otp-verify (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login/otp-verify%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/login/otp-verify (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login/otp-verify/
  * Node Name: `http://localhost:3000/api/v1/auth/login/otp-verify/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/me
  * Node Name: `http://localhost:3000/api/v1/auth/me ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/me%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/me (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/me%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/me (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa
  * Node Name: `http://localhost:3000/api/v1/auth/mfa ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/mfa (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/mfa (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/disable
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/disable`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/disable
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/disable ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/disable%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/disable (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/disable%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/disable (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/disable/
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/disable/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/enable
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/enable`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/enable
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/enable ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/enable%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/enable (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/enable%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/enable (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/enable/
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/enable/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/setup
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/setup`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/setup
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/setup ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/setup%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/setup (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/setup%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/setup (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/setup/
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/setup/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/verify
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/verify`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/verify%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/verify (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/verify%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/verify (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/verify/
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/verify/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/refresh
  * Node Name: `http://localhost:3000/api/v1/auth/refresh`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/refresh%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/refresh (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/refresh%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/refresh (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/refresh/
  * Node Name: `http://localhost:3000/api/v1/auth/refresh/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/register
  * Node Name: `http://localhost:3000/api/v1/auth/register`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/register%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/register (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/register%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/register (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/register/
  * Node Name: `http://localhost:3000/api/v1/auth/register/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/request-person-link
  * Node Name: `http://localhost:3000/api/v1/auth/request-person-link`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/request-person-link%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/request-person-link (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/request-person-link%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/request-person-link (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/request-person-link/
  * Node Name: `http://localhost:3000/api/v1/auth/request-person-link/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/resend-verification
  * Node Name: `http://localhost:3000/api/v1/auth/resend-verification`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/resend-verification%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/resend-verification (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/resend-verification%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/resend-verification (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/resend-verification/
  * Node Name: `http://localhost:3000/api/v1/auth/resend-verification/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/reset-password
  * Node Name: `http://localhost:3000/api/v1/auth/reset-password`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/reset-password%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/reset-password (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/reset-password%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/reset-password (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/reset-password/
  * Node Name: `http://localhost:3000/api/v1/auth/reset-password/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/update-phone
  * Node Name: `http://localhost:3000/api/v1/auth/update-phone`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/update-phone
  * Node Name: `http://localhost:3000/api/v1/auth/update-phone ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/update-phone%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/update-phone (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/update-phone%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/update-phone (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/update-phone/
  * Node Name: `http://localhost:3000/api/v1/auth/update-phone/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/verify-email
  * Node Name: `http://localhost:3000/api/v1/auth/verify-email`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/verify-email%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/verify-email (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/verify-email%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/verify-email (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/verify-email/
  * Node Name: `http://localhost:3000/api/v1/auth/verify-email/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/verify-person-link
  * Node Name: `http://localhost:3000/api/v1/auth/verify-person-link`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/verify-person-link%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/verify-person-link (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/verify-person-link%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/auth/verify-person-link (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/verify-person-link/
  * Node Name: `http://localhost:3000/api/v1/auth/verify-person-link/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries
  * Node Name: `http://localhost:3000/api/v1/beneficiaries`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries
  * Node Name: `http://localhost:3000/api/v1/beneficiaries ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries%3Fbarangay=barangay&search=ZAP&page=page&limit=limit&category=category
  * Node Name: `http://localhost:3000/api/v1/beneficiaries (barangay,category,limit,page,search)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/dashboard
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/dashboard ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/dashboard%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/dashboard (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/dashboard%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/dashboard (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/revoke
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/revoke`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/revoke
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/revoke ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/revoke%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/revoke (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/revoke%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/revoke (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/revoke/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/revoke/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/family-graph
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/family-graph ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/family-graph%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/family-graph (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/family-graph%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/family-graph (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household/nhts-pr
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household/nhts-pr ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household/nhts-pr%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household/nhts-pr (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household/nhts-pr%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household/nhts-pr (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/access-card
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/access-card ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/access-card%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/access-card (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/access-card%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/access-card (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/consent
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/consent ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/consent%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/consent (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/consent%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/consent (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/services
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/services ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/services%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/services (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/services%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/services (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases
  * Node Name: `http://localhost:3000/api/v1/cases`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases
  * Node Name: `http://localhost:3000/api/v1/cases ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases%3Fpage=1.2&limit=1.2&status=status&search=ZAP&barangay=barangay&category=category&gender=gender&ageRange=ageRange&sla=sla&dateFrom=dateFrom&dateTo=dateTo
  * Node Name: `http://localhost:3000/api/v1/cases (ageRange,barangay,category,dateFrom,dateTo,gender,limit,page,search,sla,status)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/
  * Node Name: `http://localhost:3000/api/v1/cases/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/bulk-export
  * Node Name: `http://localhost:3000/api/v1/cases/bulk-export`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/bulk-export
  * Node Name: `http://localhost:3000/api/v1/cases/bulk-export ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/bulk-export%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/bulk-export (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/bulk-export%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/bulk-export (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/bulk-export/
  * Node Name: `http://localhost:3000/api/v1/cases/bulk-export/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId
  * Node Name: `http://localhost:3000/api/v1/cases/caseId ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/caseId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/caseId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/id
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr
  * Node Name: `http://localhost:3000/api/v1/cases/csr ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/csr (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/csr (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/pdf
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/pdf ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/pdf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/pdf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/pdf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/pdf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed/pending-intervention
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/pending-intervention ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed/pending-intervention%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/pending-intervention (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed/pending-intervention%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/pending-intervention (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id
  * Node Name: `http://localhost:3000/api/v1/cases/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/approve
  * Node Name: `http://localhost:3000/api/v1/cases/id/approve ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/approve%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/approve (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/approve%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/approve (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/assessment
  * Node Name: `http://localhost:3000/api/v1/cases/id/assessment ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/assessment%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/assessment (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/assessment%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/assessment (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/close
  * Node Name: `http://localhost:3000/api/v1/cases/id/close ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/close%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/close (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/close%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/close (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/closure
  * Node Name: `http://localhost:3000/api/v1/cases/id/closure ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/closure%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/closure (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/closure%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/closure (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/csr-pdf
  * Node Name: `http://localhost:3000/api/v1/cases/id/csr-pdf ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/csr-pdf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/csr-pdf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/csr-pdf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/csr-pdf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/disburse
  * Node Name: `http://localhost:3000/api/v1/cases/id/disburse ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/disburse%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/disburse (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/disburse%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/disburse (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/documents
  * Node Name: `http://localhost:3000/api/v1/cases/id/documents ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/documents%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/documents (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/documents%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/documents (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/gis-pdf
  * Node Name: `http://localhost:3000/api/v1/cases/id/gis-pdf ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/gis-pdf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/gis-pdf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/gis-pdf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/gis-pdf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/history
  * Node Name: `http://localhost:3000/api/v1/cases/id/history ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/history%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/history (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/history%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/history (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/issue-coe
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-coe`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/issue-coe
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-coe ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/issue-coe%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-coe (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/issue-coe%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-coe (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/issue-coe/
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-coe/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/issue-pcv
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-pcv`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/issue-pcv
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-pcv ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/issue-pcv%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-pcv (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/issue-pcv%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-pcv (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/issue-pcv/
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-pcv/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/override-status
  * Node Name: `http://localhost:3000/api/v1/cases/id/override-status ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/override-status%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/override-status (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/override-status%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/override-status (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/referral-decision
  * Node Name: `http://localhost:3000/api/v1/cases/id/referral-decision ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/referral-decision%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/referral-decision (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/referral-decision%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/referral-decision (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/request-review
  * Node Name: `http://localhost:3000/api/v1/cases/id/request-review ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/request-review%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/request-review (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/request-review%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/request-review (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/requirements
  * Node Name: `http://localhost:3000/api/v1/cases/id/requirements ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/requirements%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/requirements (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/requirements%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/requirements (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/status
  * Node Name: `http://localhost:3000/api/v1/cases/id/status ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/status%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/status (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/status%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/status (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/transition-plan
  * Node Name: `http://localhost:3000/api/v1/cases/id/transition-plan ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/transition-plan%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/transition-plan (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/transition-plan%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/id/transition-plan (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker
  * Node Name: `http://localhost:3000/api/v1/cases/tracker ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/tracker (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/tracker (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/daily%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/daily (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/daily%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/daily (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/daily%3Fdate=date&status=status
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/daily (date,status)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/range%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/range (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/range%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/range (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/range%3Fstart=start&end=end&status=status
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/range (end,start,status)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/stats
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/stats ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/stats%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/stats (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/stats%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/stats (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat
  * Node Name: `http://localhost:3000/api/v1/chat ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation
  * Node Name: `http://localhost:3000/api/v1/chat/conversation ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/conversation (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/conversation (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId%3Flimit=limit
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId (limit)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/read
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/read`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/read
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/read ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/read%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/read (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/read%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/read (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/read/
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/read/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversations
  * Node Name: `http://localhost:3000/api/v1/chat/conversations ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversations%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/conversations (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversations%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/conversations (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/send
  * Node Name: `http://localhost:3000/api/v1/chat/send`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/send
  * Node Name: `http://localhost:3000/api/v1/chat/send ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/send%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/send (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/send%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/send (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/send/
  * Node Name: `http://localhost:3000/api/v1/chat/send/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/unread
  * Node Name: `http://localhost:3000/api/v1/chat/unread ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/unread%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/unread (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/unread%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/unread (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/users
  * Node Name: `http://localhost:3000/api/v1/chat/users ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/users%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/users (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/users%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/chat/users (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages
  * Node Name: `http://localhost:3000/api/v1/contact-messages`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages
  * Node Name: `http://localhost:3000/api/v1/contact-messages ()(aaa)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages
  * Node Name: `http://localhost:3000/api/v1/contact-messages ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/contact-messages (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/contact-messages (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/
  * Node Name: `http://localhost:3000/api/v1/contact-messages/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id/read
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id/read ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id/read%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id/read (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id/read%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id/read (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/unread-count
  * Node Name: `http://localhost:3000/api/v1/contact-messages/unread-count ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/unread-count%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/contact-messages/unread-count (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/unread-count%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/contact-messages/unread-count (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr
  * Node Name: `http://localhost:3000/api/v1/csr`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr
  * Node Name: `http://localhost:3000/api/v1/csr ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/csr (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/csr (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/
  * Node Name: `http://localhost:3000/api/v1/csr/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo/pdf
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/pdf ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo/pdf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/pdf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo/pdf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/pdf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/id
  * Node Name: `http://localhost:3000/api/v1/csr/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/csr/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/csr/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard
  * Node Name: `http://localhost:3000/api/v1/dashboard ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-counts%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-counts (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-counts%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-counts (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-counts%3Fyear=year&month=month
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-counts (month,year)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-tracker%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-tracker (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-tracker%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-tracker (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-tracker%3Fdate=date
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-tracker (date)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/metrics%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/metrics (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/metrics%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/metrics (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/metrics%3Fbarangay=barangay
  * Node Name: `http://localhost:3000/api/v1/dashboard/metrics (barangay)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/mayor%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/mayor (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/mayor%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/mayor (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/mayor%3FstartDate=2026-01-01&endDate=2026-12-31
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/mayor (endDate,startDate)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/sla
  * Node Name: `http://localhost:3000/api/v1/dashboard/sla ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/sla%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/sla (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/sla%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/sla (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/trends%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/trends (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/trends%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/dashboard/trends (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/trends%3Frange=1w
  * Node Name: `http://localhost:3000/api/v1/dashboard/trends (range)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export
  * Node Name: `http://localhost:3000/api/v1/export ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/export (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/export (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/audit-logs%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/export/audit-logs (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/audit-logs%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/export/audit-logs (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/audit-logs%3Fformat=pdf&startDate=startDate&endDate=endDate
  * Node Name: `http://localhost:3000/api/v1/export/audit-logs (endDate,format,startDate)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/certificate
  * Node Name: `http://localhost:3000/api/v1/export/certificate`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/certificate
  * Node Name: `http://localhost:3000/api/v1/export/certificate ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/certificate%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/export/certificate (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/certificate%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/export/certificate (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/certificate/
  * Node Name: `http://localhost:3000/api/v1/export/certificate/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/compliance%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/export/compliance (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/compliance%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/export/compliance (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/compliance%3Fformat=pdf
  * Node Name: `http://localhost:3000/api/v1/export/compliance (format)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/monthly-funds%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/export/monthly-funds (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/monthly-funds%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/export/monthly-funds (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/monthly-funds%3Fmonth=2026-08&startDate=2026-01-01&endDate=2026-12-31
  * Node Name: `http://localhost:3000/api/v1/export/monthly-funds (endDate,month,startDate)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/service-summary%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/export/service-summary (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/service-summary%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/export/service-summary (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/service-summary%3Fformat=pdf&startDate=startDate&endDate=endDate
  * Node Name: `http://localhost:3000/api/v1/export/service-summary (endDate,format,startDate)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing
  * Node Name: `http://localhost:3000/api/v1/filing ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing%3FcaseId=caseId&beneficiaryId=beneficiaryId&requirementKey=requirementKey
  * Node Name: `http://localhost:3000/api/v1/filing (beneficiaryId,caseId,requirementKey)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements
  * Node Name: `http://localhost:3000/api/v1/filing/announcements ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/announcements (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/announcements (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/photos
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/photos ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/photos%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/photos (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/photos%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/photos (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case
  * Node Name: `http://localhost:3000/api/v1/filing/case ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/case (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/case (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId/id-photo
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/id-photo ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId/id-photo%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/id-photo (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId/id-photo%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/id-photo (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/cleanup%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/cleanup (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/cleanup%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/cleanup (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/cleanup%3Fdays=days
  * Node Name: `http://localhost:3000/api/v1/filing/cleanup (days)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id
  * Node Name: `http://localhost:3000/api/v1/filing/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id/download
  * Node Name: `http://localhost:3000/api/v1/filing/id/download ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id/download%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/id/download (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id/download%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/id/download (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf
  * Node Name: `http://localhost:3000/api/v1/filing/irf ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/irf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/irf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId/photos
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/photos ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId/photos%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/photos (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId/photos%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/photos (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/upload
  * Node Name: `http://localhost:3000/api/v1/filing/upload`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/upload
  * Node Name: `http://localhost:3000/api/v1/filing/upload ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/upload%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/upload (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/upload%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/filing/upload (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/upload/
  * Node Name: `http://localhost:3000/api/v1/filing/upload/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps
  * Node Name: `http://localhost:3000/api/v1/fourps ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/compliance
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/compliance ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/compliance%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/compliance (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/compliance%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/compliance (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/generate-compliance
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/generate-compliance`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/generate-compliance
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/generate-compliance ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/generate-compliance%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/generate-compliance (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/generate-compliance%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/generate-compliance (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/generate-compliance/
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/generate-compliance/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/payouts
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/payouts`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/payouts
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/payouts ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/payouts%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/payouts (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/payouts%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/payouts (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/payouts/
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/payouts/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/meet
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/meet ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/meet%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/meet (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/meet%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/meet (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/notify
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/notify`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/notify
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/notify ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/notify%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/notify (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/notify%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/notify (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/notify/
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/notify/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/status
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/status ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/status%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/status (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/status%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/status (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health
  * Node Name: `http://localhost:3000/api/v1/health ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/health (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/health (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health/live
  * Node Name: `http://localhost:3000/api/v1/health/live ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health/live%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/health/live (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health/live%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/health/live (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health/ready
  * Node Name: `http://localhost:3000/api/v1/health/ready ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health/ready%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/health/ready (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health/ready%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/health/ready (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake
  * Node Name: `http://localhost:3000/api/v1/intake`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake
  * Node Name: `http://localhost:3000/api/v1/intake ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/intake (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/intake (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/
  * Node Name: `http://localhost:3000/api/v1/intake/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm
  * Node Name: `http://localhost:3000/api/v1/intake/confirm ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/intake/confirm (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/intake/confirm (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm/householdId
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/householdId`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm/householdId
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/householdId ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm/householdId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/householdId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm/householdId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/householdId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm/householdId/
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/householdId/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/match-check
  * Node Name: `http://localhost:3000/api/v1/intake/match-check`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/match-check
  * Node Name: `http://localhost:3000/api/v1/intake/match-check ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/match-check%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/intake/match-check (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/match-check%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/intake/match-check (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/match-check/
  * Node Name: `http://localhost:3000/api/v1/intake/match-check/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search%3Fq=q
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search (q)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case/caseId
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case/caseId ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case/caseId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case/caseId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case/caseId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case/caseId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/action
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/action ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/action%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/action (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/action%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/action (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/close
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/close ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/close%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/close (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/close%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/close (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/decline
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/decline ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/decline%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/decline (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/decline%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/decline (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/receive
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/receive ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/receive%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/receive (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/receive%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/receive (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/inbox
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/inbox ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/inbox%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/inbox (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/inbox%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/inbox (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf
  * Node Name: `http://localhost:3000/api/v1/irf`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf
  * Node Name: `http://localhost:3000/api/v1/irf ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf%3Fpage=1.2&limit=1.2
  * Node Name: `http://localhost:3000/api/v1/irf (limit,page)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/
  * Node Name: `http://localhost:3000/api/v1/irf/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case
  * Node Name: `http://localhost:3000/api/v1/irf/by-case ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/by-case (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/by-case (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case/caseId
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/caseId ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case/caseId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/caseId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case/caseId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/caseId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id
  * Node Name: `http://localhost:3000/api/v1/irf/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/close
  * Node Name: `http://localhost:3000/api/v1/irf/id/close ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/close%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/close (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/close%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/close (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/decrypt
  * Node Name: `http://localhost:3000/api/v1/irf/id/decrypt`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/decrypt
  * Node Name: `http://localhost:3000/api/v1/irf/id/decrypt ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/decrypt%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/decrypt (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/decrypt%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/decrypt (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/decrypt/
  * Node Name: `http://localhost:3000/api/v1/irf/id/decrypt/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/dismiss
  * Node Name: `http://localhost:3000/api/v1/irf/id/dismiss ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/dismiss%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/dismiss (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/dismiss%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/dismiss (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-json%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-json (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-json%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-json (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-json%3FlegalBasis=legalBasis
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-json (legalBasis)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-pdf
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-pdf`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-pdf
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-pdf ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-pdf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-pdf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-pdf%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-pdf (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-pdf/
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-pdf/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-wcpd%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-wcpd (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-wcpd%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-wcpd (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-wcpd%3FlegalBasis=legalBasis
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-wcpd (legalBasis)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/narration
  * Node Name: `http://localhost:3000/api/v1/irf/id/narration ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/narration%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/narration (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/narration%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/narration (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/override-disposition
  * Node Name: `http://localhost:3000/api/v1/irf/id/override-disposition ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/override-disposition%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/override-disposition (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/override-disposition%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/override-disposition (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/refer-pnp
  * Node Name: `http://localhost:3000/api/v1/irf/id/refer-pnp ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/refer-pnp%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/refer-pnp (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/refer-pnp%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/refer-pnp (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/refer-wcpd
  * Node Name: `http://localhost:3000/api/v1/irf/id/refer-wcpd ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/refer-wcpd%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/refer-wcpd (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/refer-wcpd%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/refer-wcpd (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/unmask-names%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/unmask-names (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/unmask-names%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/irf/id/unmask-names (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/unmask-names%3FlegalBasis=legalBasis
  * Node Name: `http://localhost:3000/api/v1/irf/id/unmask-names (legalBasis)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr
  * Node Name: `http://localhost:3000/api/v1/lcr ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/lcr (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/lcr (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/import
  * Node Name: `http://localhost:3000/api/v1/lcr/import`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/import
  * Node Name: `http://localhost:3000/api/v1/lcr/import ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/import%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/lcr/import (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/import%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/lcr/import (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/import-batch
  * Node Name: `http://localhost:3000/api/v1/lcr/import-batch`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/import-batch
  * Node Name: `http://localhost:3000/api/v1/lcr/import-batch ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/import-batch%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/lcr/import-batch (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/import-batch%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/lcr/import-batch (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/import-batch/
  * Node Name: `http://localhost:3000/api/v1/lcr/import-batch/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr/import/
  * Node Name: `http://localhost:3000/api/v1/lcr/import/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio
  * Node Name: `http://localhost:3000/api/v1/minio ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/minio (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/minio (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/fileName
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/fileName ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/fileName%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/fileName (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/fileName%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/fileName (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/upload
  * Node Name: `http://localhost:3000/api/v1/minio/upload`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/upload
  * Node Name: `http://localhost:3000/api/v1/minio/upload ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/upload%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/minio/upload (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/upload%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/minio/upload (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/upload/
  * Node Name: `http://localhost:3000/api/v1/minio/upload/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications
  * Node Name: `http://localhost:3000/api/v1/notifications`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications
  * Node Name: `http://localhost:3000/api/v1/notifications ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/
  * Node Name: `http://localhost:3000/api/v1/notifications/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id
  * Node Name: `http://localhost:3000/api/v1/notifications/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/read
  * Node Name: `http://localhost:3000/api/v1/notifications/id/read`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/read
  * Node Name: `http://localhost:3000/api/v1/notifications/id/read ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/read%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/id/read (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/read%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/id/read (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/read/
  * Node Name: `http://localhost:3000/api/v1/notifications/id/read/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/send
  * Node Name: `http://localhost:3000/api/v1/notifications/id/send`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/send
  * Node Name: `http://localhost:3000/api/v1/notifications/id/send ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/send%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/id/send (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/send%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/id/send (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/send-with-consent
  * Node Name: `http://localhost:3000/api/v1/notifications/id/send-with-consent`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/send-with-consent
  * Node Name: `http://localhost:3000/api/v1/notifications/id/send-with-consent ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/send-with-consent%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/id/send-with-consent (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/send-with-consent%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/id/send-with-consent (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/send-with-consent/
  * Node Name: `http://localhost:3000/api/v1/notifications/id/send-with-consent/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/send/
  * Node Name: `http://localhost:3000/api/v1/notifications/id/send/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/my
  * Node Name: `http://localhost:3000/api/v1/notifications/my ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/my%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/my (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/my%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/my (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/bulk
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/bulk ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/bulk%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/bulk (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/bulk%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/bulk (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/read-all
  * Node Name: `http://localhost:3000/api/v1/notifications/read-all`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/read-all
  * Node Name: `http://localhost:3000/api/v1/notifications/read-all ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/read-all%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/read-all (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/read-all%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/read-all (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/read-all/
  * Node Name: `http://localhost:3000/api/v1/notifications/read-all/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient/recipientId
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/recipientId ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient/recipientId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/recipientId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient/recipientId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/recipientId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/unread
  * Node Name: `http://localhost:3000/api/v1/notifications/unread ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/unread%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/unread (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/unread%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/notifications/unread (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs
  * Node Name: `http://localhost:3000/api/v1/programs`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs
  * Node Name: `http://localhost:3000/api/v1/programs ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/programs (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/programs (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs%3FactiveOnly=activeOnly
  * Node Name: `http://localhost:3000/api/v1/programs (activeOnly)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/
  * Node Name: `http://localhost:3000/api/v1/programs/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/id
  * Node Name: `http://localhost:3000/api/v1/programs/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/programs/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/programs/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public
  * Node Name: `http://localhost:3000/api/v1/programs/public ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/programs/public (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/programs/public (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/programs/public/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/programs/public/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals
  * Node Name: `http://localhost:3000/api/v1/referrals`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals
  * Node Name: `http://localhost:3000/api/v1/referrals ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals%3Fbarangay=barangay&status=status&intakePending=intakePending
  * Node Name: `http://localhost:3000/api/v1/referrals (barangay,intakePending,status)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/
  * Node Name: `http://localhost:3000/api/v1/referrals/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/counts
  * Node Name: `http://localhost:3000/api/v1/referrals/counts ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/counts%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals/counts (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/counts%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals/counts (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id
  * Node Name: `http://localhost:3000/api/v1/referrals/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/accept
  * Node Name: `http://localhost:3000/api/v1/referrals/id/accept ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/accept%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals/id/accept (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/accept%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals/id/accept (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/decline
  * Node Name: `http://localhost:3000/api/v1/referrals/id/decline ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/decline%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals/id/decline (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/decline%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals/id/decline (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/mine
  * Node Name: `http://localhost:3000/api/v1/referrals/mine ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/mine%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals/mine (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/mine%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals/mine (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/pending-count%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals/pending-count (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/pending-count%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/referrals/pending-count (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/pending-count%3Fbarangay=barangay
  * Node Name: `http://localhost:3000/api/v1/referrals/pending-count (barangay)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla
  * Node Name: `http://localhost:3000/api/v1/sla ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sla (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sla (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla/check
  * Node Name: `http://localhost:3000/api/v1/sla/check`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla/check
  * Node Name: `http://localhost:3000/api/v1/sla/check ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla/check%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sla/check (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla/check%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sla/check (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla/check/
  * Node Name: `http://localhost:3000/api/v1/sla/check/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync
  * Node Name: `http://localhost:3000/api/v1/sync ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/deviceId
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/deviceId ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/deviceId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/deviceId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/deviceId%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/deviceId (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id/resolve
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/resolve`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id/resolve
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/resolve ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id/resolve%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/resolve (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id/resolve%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/resolve (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id/resolve/
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/resolve/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/pull
  * Node Name: `http://localhost:3000/api/v1/sync/pull`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/pull
  * Node Name: `http://localhost:3000/api/v1/sync/pull ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/pull%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync/pull (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/pull%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync/pull (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/pull/
  * Node Name: `http://localhost:3000/api/v1/sync/pull/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/v1
  * Node Name: `http://localhost:3000/api/v1/sync/v1`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/v1
  * Node Name: `http://localhost:3000/api/v1/sync/v1 ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/v1%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync/v1 (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/v1%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/sync/v1 (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/v1/
  * Node Name: `http://localhost:3000/api/v1/sync/v1/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users
  * Node Name: `http://localhost:3000/api/v1/users`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users
  * Node Name: `http://localhost:3000/api/v1/users ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/users (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/users (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users%3Fsearch=ZAP&role=role&status=status&page=page&limit=limit
  * Node Name: `http://localhost:3000/api/v1/users (limit,page,role,search,status)(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/
  * Node Name: `http://localhost:3000/api/v1/users/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/id
  * Node Name: `http://localhost:3000/api/v1/users/id ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/users/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo b0svoj9z10ak...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/id%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:3000/api/v1/users/id (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo b0svoj9z10ak6re5njuh',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/computeMetadata/v1/
  * Node Name: `http://localhost:3000/computeMetadata/v1/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/latest/meta-data/
  * Node Name: `http://localhost:3000/latest/meta-data/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/metadata/instance
  * Node Name: `http://localhost:3000/metadata/instance`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/metadata/v1
  * Node Name: `http://localhost:3000/metadata/v1`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/opc/v1/instance/
  * Node Name: `http://localhost:3000/opc/v1/instance/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/opc/v2/instance/
  * Node Name: `http://localhost:3000/opc/v2/instance/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/openstack/latest/meta_data.json
  * Node Name: `http://localhost:3000/openstack/latest/meta_data.json`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences`
  * Method: `PUT`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/`
  * Method: `PUT`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/bulk
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/bulk ()([])`
  * Method: `PUT`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/bulk/
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/bulk/ ()([])`
  * Method: `PUT`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``


Instances: 1847

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Non-Storable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are not storable by caching components such as proxy servers. If the response does not contain sensitive, personal or user-specific information, it may benefit from being stored and cached, to improve performance.

* URL: http://localhost:3000/api/v1
  * Node Name: `http://localhost:3000/api/v1`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health
  * Node Name: `http://localhost:3000/api/v1/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/disable
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/disable`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm/householdId
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/householdId`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/pull
  * Node Name: `http://localhost:3000/api/v1/sync/pull`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``

Instances: Systemic


### Solution

The content may be marked as storable by ensuring that the following conditions are satisfied:
The request method must be understood by the cache and defined as being cacheable ("GET", "HEAD", and "POST" are currently defined as cacheable)
The response status code must be understood by the cache (one of the 1XX, 2XX, 3XX, 4XX, or 5XX response classes are generally understood)
The "no-store" cache directive must not appear in the request or response header fields
For caching by "shared" caches such as "proxy" caches, the "private" response directive must not appear in the response
For caching by "shared" caches such as "proxy" caches, the "Authorization" header field must not appear in the request, unless the response explicitly allows it (using one of the "must-revalidate", "public", or "s-maxage" Cache-Control response directives)
In addition to the conditions above, at least one of the following conditions must also be satisfied by the response:
It must contain an "Expires" header field
It must contain a "max-age" response directive
For "shared" caches such as "proxy" caches, it must contain a "s-maxage" response directive
It must contain a "Cache Control Extension" that allows it to be cached
It must have a status code that is defined as cacheable by default (200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501).

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3

### [ Session Management Response Identified ](https://www.zaproxy.org/docs/alerts/10112/)



##### Informational (Medium)

### Description

The given response has been identified as containing a session management token. The 'Other Info' field contains a set of header tokens that can be used in the Header Based Session Management Method. If the request is in a context which has a Session Management Method set to "Auto-Detect" then this rule will change the session management to use the tokens identified.

* URL: http://localhost:3000/api/v1
  * Node Name: `http://localhost:3000/api/v1`
  * Method: `GET`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/me
  * Node Name: `http://localhost:3000/api/v1/auth/me`
  * Method: `GET`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/cases%3Fpage=1.2&limit=1.2&status=status&search=ZAP&barangay=barangay&category=category&gender=gender&ageRange=ageRange&sla=sla&dateFrom=dateFrom&dateTo=dateTo
  * Node Name: `http://localhost:3000/api/v1/cases (ageRange,barangay,category,dateFrom,dateTo,gender,limit,page,search,sla,status)`
  * Method: `GET`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/health
  * Node Name: `http://localhost:3000/api/v1/health`
  * Method: `GET`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/health/live
  * Node Name: `http://localhost:3000/api/v1/health/live`
  * Method: `GET`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/health/ready
  * Node Name: `http://localhost:3000/api/v1/health/ready`
  * Method: `GET`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/sync/conflicts/deviceId
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/deviceId`
  * Method: `GET`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/change-email
  * Node Name: `http://localhost:3000/api/v1/auth/change-email`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/change-password
  * Node Name: `http://localhost:3000/api/v1/auth/change-password`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/confirm-email-change
  * Node Name: `http://localhost:3000/api/v1/auth/confirm-email-change`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/forgot-password
  * Node Name: `http://localhost:3000/api/v1/auth/forgot-password`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/login
  * Node Name: `http://localhost:3000/api/v1/auth/login`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/login/otp-verify
  * Node Name: `http://localhost:3000/api/v1/auth/login/otp-verify`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/mfa/disable
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/disable`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/mfa/enable
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/enable`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/mfa/setup
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/setup`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/mfa/verify
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/verify`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/refresh
  * Node Name: `http://localhost:3000/api/v1/auth/refresh`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/register
  * Node Name: `http://localhost:3000/api/v1/auth/register`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/request-person-link
  * Node Name: `http://localhost:3000/api/v1/auth/request-person-link`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/resend-verification
  * Node Name: `http://localhost:3000/api/v1/auth/resend-verification`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/reset-password
  * Node Name: `http://localhost:3000/api/v1/auth/reset-password`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/update-phone
  * Node Name: `http://localhost:3000/api/v1/auth/update-phone`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/verify-email
  * Node Name: `http://localhost:3000/api/v1/auth/verify-email`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/auth/verify-person-link
  * Node Name: `http://localhost:3000/api/v1/auth/verify-person-link`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/intake
  * Node Name: `http://localhost:3000/api/v1/intake`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/intake/confirm/householdId
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/householdId`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/intake/match-check
  * Node Name: `http://localhost:3000/api/v1/intake/match-check`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/sync/conflicts/id/resolve
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/resolve`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/sync/pull
  * Node Name: `http://localhost:3000/api/v1/sync/pull`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`
* URL: http://localhost:3000/api/v1/sync/v1
  * Node Name: `http://localhost:3000/api/v1/sync/v1`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `csrf-token`
  * Other Info: `cookie:csrf-token`


Instances: 31

### Solution

This is an informational alert rather than a vulnerability and so there is nothing to fix.

### Reference


* [ https://www.zaproxy.org/docs/desktop/addons/authentication-helper/session-mgmt-id/ ](https://www.zaproxy.org/docs/desktop/addons/authentication-helper/session-mgmt-id/)



#### Source ID: 3

### [ User Agent Fuzzer ](https://www.zaproxy.org/docs/alerts/10104/)



##### Informational (Medium)

### Description

Check for differences in response based on fuzzed User Agent (eg. mobile sites, access as a Search Engine Crawler). Compares the response statuscode and the hashcode of the response body with the original response.

* URL: http://localhost:3000/api/v1/announcements/id
  * Node Name: `http://localhost:3000/api/v1/announcements/id`
  * Method: `PATCH`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/beneficiaryId
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/beneficiaryId`
  * Method: `POST`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/log
  * Node Name: `http://localhost:3000/api/v1/access-cards/log`
  * Method: `POST`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies
  * Node Name: `http://localhost:3000/api/v1/agencies`
  * Method: `POST`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements
  * Node Name: `http://localhost:3000/api/v1/announcements`
  * Method: `POST`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``

Instances: Systemic


### Solution



### Reference


* [ https://owasp.org/wstg ](https://owasp.org/wstg)



#### Source ID: 1


