# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 1 |
| Medium | 0 |
| Low | 3 |
| Informational | 4 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Low | Exceeded High | http://localhost:3000 | Percentage of responses with status code 4xx | 99 % |
| Info | Informational | http://localhost:3000 | Percentage of responses with status code 2xx | 1 % |
| Info | Informational | http://localhost:3000 | Percentage of responses with status code 5xx | 1 % |
| Info | Informational | http://localhost:3000 | Percentage of endpoints with content type application/json | 100 % |
| Info | Informational | http://localhost:3000 | Percentage of endpoints with method DELETE | 2 % |
| Info | Informational | http://localhost:3000 | Percentage of endpoints with method GET | 64 % |
| Info | Informational | http://localhost:3000 | Percentage of endpoints with method PATCH | 11 % |
| Info | Informational | http://localhost:3000 | Percentage of endpoints with method POST | 20 % |
| Info | Informational | http://localhost:3000 | Count of total endpoints | 618    |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| SQL Injection | High | 5 |
| A Server Error response code was returned by the server | Low | 6 |
| Application Error Disclosure | Low | 2 |
| Cookie No HttpOnly Flag | Low | Systemic |
| A Client Error response code was returned by the server | Informational | 656 |
| Information Disclosure - Sensitive Information in URL | Informational | 1 |
| Non-Storable Content | Informational | Systemic |
| Session Management Response Identified | Informational | 31 |




## Alert Detail



### [ SQL Injection ](https://www.zaproxy.org/docs/alerts/40018/)



##### High (Medium)

### Description

SQL injection may be possible.

* URL: http://localhost:3000/api/v1/cases%3Fpage=1.2&limit=1.2&status=status&search=ZAP&barangay=barangay&category=category&gender=gender&ageRange=ageRange+AND+1%253D1+--+&sla=sla&dateFrom=dateFrom&dateTo=dateTo
  * Node Name: `http://localhost:3000/api/v1/cases (ageRange,barangay,category,dateFrom,dateTo,gender,limit,page,search,sla,status)`
  * Method: `GET`
  * Parameter: `ageRange`
  * Attack: `ageRange AND 1=1 -- `
  * Evidence: ``
  * Other Info: `The page results were successfully manipulated using the boolean conditions [ageRange AND 1=1 -- ] and [ageRange AND 1=2 -- ]
The parameter value being modified was stripped from the HTML output for the purposes of the comparison.
Data was returned for the original parameter.
The vulnerability was detected by successfully restricting the data originally returned, by manipulating the parameter.`
* URL: http://localhost:3000/api/v1/cases%3Fpage=1.2&limit=1.2&status=status&search=ZAP&barangay=barangay&category=category+AND+1%253D1+--+&gender=gender&ageRange=ageRange&sla=sla&dateFrom=dateFrom&dateTo=dateTo
  * Node Name: `http://localhost:3000/api/v1/cases (ageRange,barangay,category,dateFrom,dateTo,gender,limit,page,search,sla,status)`
  * Method: `GET`
  * Parameter: `category`
  * Attack: `category AND 1=1 -- `
  * Evidence: ``
  * Other Info: `The page results were successfully manipulated using the boolean conditions [category AND 1=1 -- ] and [category AND 1=2 -- ]
The parameter value being modified was stripped from the HTML output for the purposes of the comparison.
Data was returned for the original parameter.
The vulnerability was detected by successfully restricting the data originally returned, by manipulating the parameter.`
* URL: http://localhost:3000/api/v1/cases%3Fpage=1.2&limit=1.2&status=status&search=ZAP&barangay=barangay&category=category&gender=gender+AND+1%253D1+--+&ageRange=ageRange&sla=sla&dateFrom=dateFrom&dateTo=dateTo
  * Node Name: `http://localhost:3000/api/v1/cases (ageRange,barangay,category,dateFrom,dateTo,gender,limit,page,search,sla,status)`
  * Method: `GET`
  * Parameter: `gender`
  * Attack: `gender AND 1=1 -- `
  * Evidence: ``
  * Other Info: `The page results were successfully manipulated using the boolean conditions [gender AND 1=1 -- ] and [gender AND 1=2 -- ]
The parameter value being modified was stripped from the HTML output for the purposes of the comparison.
Data was returned for the original parameter.
The vulnerability was detected by successfully restricting the data originally returned, by manipulating the parameter.`
* URL: http://localhost:3000/api/v1/cases%3Fpage=1.2&limit=1.2&status=status&search=ZAP&barangay=barangay&category=category&gender=gender&ageRange=ageRange&sla=sla+AND+1%253D1+--+&dateFrom=dateFrom&dateTo=dateTo
  * Node Name: `http://localhost:3000/api/v1/cases (ageRange,barangay,category,dateFrom,dateTo,gender,limit,page,search,sla,status)`
  * Method: `GET`
  * Parameter: `sla`
  * Attack: `sla AND 1=1 -- `
  * Evidence: ``
  * Other Info: `The page results were successfully manipulated using the boolean conditions [sla AND 1=1 -- ] and [sla AND 1=2 -- ]
The parameter value being modified was stripped from the HTML output for the purposes of the comparison.
Data was returned for the original parameter.
The vulnerability was detected by successfully restricting the data originally returned, by manipulating the parameter.`
* URL: http://localhost:3000/api/v1/referrals%3Fbarangay=barangay&status=status&intakePending=intakePending+AND+1%253D1+--+
  * Node Name: `http://localhost:3000/api/v1/referrals (barangay,intakePending,status)`
  * Method: `GET`
  * Parameter: `intakePending`
  * Attack: `intakePending AND 1=1 -- `
  * Evidence: ``
  * Other Info: `The page results were successfully manipulated using the boolean conditions [intakePending AND 1=1 -- ] and [intakePending AND 1=2 -- ]
The parameter value being modified was stripped from the HTML output for the purposes of the comparison.
Data was returned for the original parameter.
The vulnerability was detected by successfully restricting the data originally returned, by manipulating the parameter.`


Instances: 5

### Solution

Do not trust client side input, even if there is client side validation in place.
In general, type check all data on the server side.
If the application uses JDBC, use PreparedStatement or CallableStatement, with parameters passed by '?'
If the application uses ASP, use ADO Command Objects with strong type checking and parameterized queries.
If database Stored Procedures can be used, use them.
Do *not* concatenate strings into queries in the stored procedure, or use 'exec', 'exec immediate', or equivalent functionality!
Do not create dynamic SQL queries using simple string concatenation.
Escape all data received from the client.
Apply an 'allow list' of allowed characters, or a 'deny list' of disallowed characters in user input.
Apply the principle of least privilege by using the least privileged database user possible.
In particular, avoid using the 'sa' or 'db-owner' database users. This does not eliminate SQL injection, but minimizes its impact.
Grant the minimum database access that is necessary for the application.

### Reference


* [ https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html ](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)


#### CWE Id: [ 89 ](https://cwe.mitre.org/data/definitions/89.html)


#### WASC Id: 19

#### Source ID: 1

### [ A Server Error response code was returned by the server ](https://www.zaproxy.org/docs/alerts/100000/)



##### Low (High)

### Description

A response code of 500 was returned by the server.
This may indicate that the application is failing to handle unexpected input correctly.
Raised by the 'Alert on HTTP Response Code Error' script

* URL: http://localhost:3000/api/v1/announcements/public/photo/9074157531074931641
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/9074157531074931641`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo/id
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/photo/id/
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public/1071170447871843087
  * Node Name: `http://localhost:3000/api/v1/programs/public/1071170447871843087`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public/id
  * Node Name: `http://localhost:3000/api/v1/programs/public/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public/id/
  * Node Name: `http://localhost:3000/api/v1/programs/public/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``


Instances: 6

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Application Error Disclosure ](https://www.zaproxy.org/docs/alerts/90022/)



##### Low (Medium)

### Description

This page contains an error/warning message that may disclose sensitive information like the location of the file that produced the unhandled exception. This information can be used to launch further attacks against the web application. The alert could be a false positive if the error message is found inside a documentation page.

* URL: http://localhost:3000/api/v1/announcements/public/photo/id
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `HTTP/1.1 500 Internal Server Error`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/public/id
  * Node Name: `http://localhost:3000/api/v1/programs/public/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `HTTP/1.1 500 Internal Server Error`
  * Other Info: ``


Instances: 2

### Solution

Review the source code of this page. Implement custom error pages. Consider implementing a mechanism to provide a unique error reference/identifier to the client (browser) while logging the details on the server side and not exposing them to the user.

### Reference



#### CWE Id: [ 550 ](https://cwe.mitre.org/data/definitions/550.html)


#### WASC Id: 13

#### Source ID: 3

### [ Cookie No HttpOnly Flag ](https://www.zaproxy.org/docs/alerts/10010/)



##### Low (Medium)

### Description

A cookie has been set without the HttpOnly flag, which means that the cookie can be accessed by JavaScript. If a malicious script can be run on this page then the cookie will be accessible and can be transmitted to another site. If this is a session cookie then session hijacking may be possible.

* URL: http://localhost:3000/api/v1/auth/mfa/disable
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/disable`
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
* URL: http://localhost:3000/api/v1/auth/request-person-link
  * Node Name: `http://localhost:3000/api/v1/auth/request-person-link`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `Set-Cookie: csrf-token`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/resend-verification
  * Node Name: `http://localhost:3000/api/v1/auth/resend-verification`
  * Method: `POST`
  * Parameter: `csrf-token`
  * Attack: ``
  * Evidence: `Set-Cookie: csrf-token`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/verify-person-link
  * Node Name: `http://localhost:3000/api/v1/auth/verify-person-link`
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
* URL: http://localhost:3000/api/v1/filing/cleanup%3Fdays=days%2527%2526cat+%252Fetc%252Fpasswd%2526%2527
  * Node Name: `http://localhost:3000/api/v1/filing/cleanup (days)`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/cleanup/
  * Node Name: `http://localhost:3000/api/v1/filing/cleanup/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
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
  * Evidence: `429`
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
* URL: http://localhost:3000/
  * Node Name: `http://localhost:3000/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/5156918048192571461
  * Node Name: `http://localhost:3000/5156918048192571461`
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
* URL: http://localhost:3000/api/
  * Node Name: `http://localhost:3000/api/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/4836025457628198889
  * Node Name: `http://localhost:3000/api/4836025457628198889`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/6378144260585354940
  * Node Name: `http://localhost:3000/api/v1/6378144260585354940`
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
* URL: http://localhost:3000/api/v1/access-cards
  * Node Name: `http://localhost:3000/api/v1/access-cards`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards%3Fpage=1.2&limit=1.2&sourceBarangay=sourceBarangay
  * Node Name: `http://localhost:3000/api/v1/access-cards (limit,page,sourceBarangay)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards%3Fpage=%253C%2521--%2523EXEC+cmd%253D%2522ls+%252F%2522--%253E&limit=1.2&sourceBarangay=sourceBarangay
  * Node Name: `http://localhost:3000/api/v1/access-cards (limit,page,sourceBarangay)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/
  * Node Name: `http://localhost:3000/api/v1/access-cards/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/3757229836781216177
  * Node Name: `http://localhost:3000/api/v1/access-cards/3757229836781216177`
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
* URL: http://localhost:3000/api/v1/access-cards/assign
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/assign/375151477379142156
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/375151477379142156`
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
* URL: http://localhost:3000/api/v1/access-cards/beneficiary
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/6470020917609394388
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/6470020917609394388`
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
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/107073943194953795
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/107073943194953795`
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
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/5339230441909591740
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/5339230441909591740`
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
* URL: http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary/
  * Node Name: `http://localhost:3000/api/v1/access-cards/beneficiary/id/card/summary/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/cardCode
  * Node Name: `http://localhost:3000/api/v1/access-cards/cardCode`
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
* URL: http://localhost:3000/api/v1/access-cards/code
  * Node Name: `http://localhost:3000/api/v1/access-cards/code`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code/
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/access-cards/code/553580256488039462
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/553580256488039462`
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
* URL: http://localhost:3000/api/v1/access-cards/code/summary/
  * Node Name: `http://localhost:3000/api/v1/access-cards/code/summary/`
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
* URL: http://localhost:3000/api/v1/agencies/
  * Node Name: `http://localhost:3000/api/v1/agencies/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agencies/7168350166775032876
  * Node Name: `http://localhost:3000/api/v1/agencies/7168350166775032876`
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
* URL: http://localhost:3000/api/v1/agencies/id/
  * Node Name: `http://localhost:3000/api/v1/agencies/id/`
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
* URL: http://localhost:3000/api/v1/agency-portal/
  * Node Name: `http://localhost:3000/api/v1/agency-portal/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/agency-portal/1655311600824153399
  * Node Name: `http://localhost:3000/api/v1/agency-portal/1655311600824153399`
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
* URL: http://localhost:3000/api/v1/agency-portal/profile/
  * Node Name: `http://localhost:3000/api/v1/agency-portal/profile/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements
  * Node Name: `http://localhost:3000/api/v1/announcements`
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
* URL: http://localhost:3000/api/v1/announcements/1244041501392981427
  * Node Name: `http://localhost:3000/api/v1/announcements/1244041501392981427`
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
* URL: http://localhost:3000/api/v1/announcements/id/
  * Node Name: `http://localhost:3000/api/v1/announcements/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/id/4572746180268713182
  * Node Name: `http://localhost:3000/api/v1/announcements/id/4572746180268713182`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/551319096224255551
  * Node Name: `http://localhost:3000/api/v1/announcements/public/551319096224255551`
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
* URL: http://localhost:3000/api/v1/announcements/public/photo/
  * Node Name: `http://localhost:3000/api/v1/announcements/public/photo/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements/public/slug
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug`
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
* URL: http://localhost:3000/api/v1/announcements/public/slug/3467178774798758166
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug/3467178774798758166`
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
* URL: http://localhost:3000/api/v1/announcements/public/slug/photos/
  * Node Name: `http://localhost:3000/api/v1/announcements/public/slug/photos/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit
  * Node Name: `http://localhost:3000/api/v1/audit`
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
* URL: http://localhost:3000/api/v1/audit/3180090319491446298
  * Node Name: `http://localhost:3000/api/v1/audit/3180090319491446298`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/coa-export%3FstartDate=startDate&endDate=endDate
  * Node Name: `http://localhost:3000/api/v1/audit/coa-export (endDate,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/coa-export%3FstartDate=startDate+AND+1%253D1&endDate=endDate
  * Node Name: `http://localhost:3000/api/v1/audit/coa-export (endDate,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/coa-export/
  * Node Name: `http://localhost:3000/api/v1/audit/coa-export/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/consent-ledger%3FbeneficiaryId=beneficiaryId&limit=limit
  * Node Name: `http://localhost:3000/api/v1/audit/consent-ledger (beneficiaryId,limit)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/consent-ledger%3FbeneficiaryId=beneficiaryId+AND+1%253D1&limit=limit
  * Node Name: `http://localhost:3000/api/v1/audit/consent-ledger (beneficiaryId,limit)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/consent-ledger/
  * Node Name: `http://localhost:3000/api/v1/audit/consent-ledger/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/logs%3Ftable=table&recordId=recordId&limit=1.2
  * Node Name: `http://localhost:3000/api/v1/audit/logs (limit,recordId,table)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/logs%3Ftable=%253C%2521--%2523EXEC+cmd%253D%2522dir+%255C%2522--%253E&recordId=recordId&limit=1.2
  * Node Name: `http://localhost:3000/api/v1/audit/logs (limit,recordId,table)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/logs/
  * Node Name: `http://localhost:3000/api/v1/audit/logs/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/audit/verify-all
  * Node Name: `http://localhost:3000/api/v1/audit/verify-all`
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
* URL: http://localhost:3000/api/v1/auth/
  * Node Name: `http://localhost:3000/api/v1/auth/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/8716950761771226602
  * Node Name: `http://localhost:3000/api/v1/auth/8716950761771226602`
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
* URL: http://localhost:3000/api/v1/auth/login/
  * Node Name: `http://localhost:3000/api/v1/auth/login/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/login/305325061444461977
  * Node Name: `http://localhost:3000/api/v1/auth/login/305325061444461977`
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
* URL: http://localhost:3000/api/v1/auth/mfa/
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/4182732679849494436
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/4182732679849494436`
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
* URL: http://localhost:3000/api/v1/beneficiaries
  * Node Name: `http://localhost:3000/api/v1/beneficiaries`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries%3Fbarangay=barangay&search=ZAP&page=page&limit=limit&category=category
  * Node Name: `http://localhost:3000/api/v1/beneficiaries (barangay,category,limit,page,search)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries%3Fbarangay=https%253A%252F%252F%255C1145766686099223147.owasp.org&search=ZAP&page=page&limit=limit&category=category
  * Node Name: `http://localhost:3000/api/v1/beneficiaries (barangay,category,limit,page,search)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/1218946404001724067
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/1218946404001724067`
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
* URL: http://localhost:3000/api/v1/beneficiaries/id/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/5120492728975990058
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/5120492728975990058`
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
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/590178375022383804
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/590178375022383804`
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
* URL: http://localhost:3000/api/v1/beneficiaries/id/household/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/household/388418677687194502
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/household/388418677687194502`
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
* URL: http://localhost:3000/api/v1/beneficiaries/me/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/me/5616088300744918953
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/5616088300744918953`
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
* URL: http://localhost:3000/api/v1/beneficiaries/me/services/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/me/services/`
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
* URL: http://localhost:3000/api/v1/cases
  * Node Name: `http://localhost:3000/api/v1/cases`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases%3Fpage=1.2&limit=1.2&status=status&search=ZAP&barangay=barangay&category=category&gender=gender&ageRange=ageRange&sla=sla&dateFrom=dateFrom&dateTo=dateTo
  * Node Name: `http://localhost:3000/api/v1/cases (ageRange,barangay,category,dateFrom,dateTo,gender,limit,page,search,sla,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases%3Fpage=1.2&limit=1.2&status=status&search=ZAP&barangay=barangay&category=www.google.com%252Fsearch%253Fq%253DZAP&gender=gender&ageRange=ageRange&sla=sla&dateFrom=dateFrom&dateTo=dateTo
  * Node Name: `http://localhost:3000/api/v1/cases (ageRange,barangay,category,dateFrom,dateTo,gender,limit,page,search,sla,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/
  * Node Name: `http://localhost:3000/api/v1/cases/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/7752965121302280018
  * Node Name: `http://localhost:3000/api/v1/cases/7752965121302280018`
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
* URL: http://localhost:3000/api/v1/cases/caseId
  * Node Name: `http://localhost:3000/api/v1/cases/caseId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/5902257291428127274
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/5902257291428127274`
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
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions/4611800598255909028
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions/4611800598255909028`
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
* URL: http://localhost:3000/api/v1/cases/csr
  * Node Name: `http://localhost:3000/api/v1/cases/csr`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/
  * Node Name: `http://localhost:3000/api/v1/cases/csr/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/5881242370710518710
  * Node Name: `http://localhost:3000/api/v1/cases/csr/5881242370710518710`
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
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/8844064665940688971
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/8844064665940688971`
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
* URL: http://localhost:3000/api/v1/cases/csr/controlNo/pdf/
  * Node Name: `http://localhost:3000/api/v1/cases/csr/controlNo/pdf/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed/
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/disbursed/6292515755430087986
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/6292515755430087986`
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
* URL: http://localhost:3000/api/v1/cases/disbursed/pending-intervention/
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/pending-intervention/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id
  * Node Name: `http://localhost:3000/api/v1/cases/id`
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
* URL: http://localhost:3000/api/v1/cases/id/3629533918808438533
  * Node Name: `http://localhost:3000/api/v1/cases/id/3629533918808438533`
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
* URL: http://localhost:3000/api/v1/cases/id/csr-pdf/
  * Node Name: `http://localhost:3000/api/v1/cases/id/csr-pdf/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/id/gis-pdf
  * Node Name: `http://localhost:3000/api/v1/cases/id/gis-pdf`
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
* URL: http://localhost:3000/api/v1/cases/id/history/
  * Node Name: `http://localhost:3000/api/v1/cases/id/history/`
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
* URL: http://localhost:3000/api/v1/cases/tracker
  * Node Name: `http://localhost:3000/api/v1/cases/tracker`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/716643878949557358
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/716643878949557358`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/daily%3Fdate=date&status=status
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/daily (date,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/daily%3Fdate=date+AND+1%253D1&status=status
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/daily (date,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/daily/
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/daily/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/range%3Fstart=start&end=end&status=status
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/range (end,start,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/range%3Fstart=%253C%2521--%2523EXEC+cmd%253D%2522dir+%255C%2522--%253E&end=end&status=status
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/range (end,start,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/range/
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/range/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/tracker/stats
  * Node Name: `http://localhost:3000/api/v1/cases/tracker/stats`
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
* URL: http://localhost:3000/api/v1/chat
  * Node Name: `http://localhost:3000/api/v1/chat`
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
* URL: http://localhost:3000/api/v1/chat/9211601429812190927
  * Node Name: `http://localhost:3000/api/v1/chat/9211601429812190927`
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
* URL: http://localhost:3000/api/v1/chat/conversation/
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/3457256265698073379
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/3457256265698073379`
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
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId%3Flimit=limit
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId (limit)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId%3Flimit=cat+%252Fetc%252Fpasswd
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId (limit)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/5279313224069975049
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/5279313224069975049`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversations
  * Node Name: `http://localhost:3000/api/v1/chat/conversations`
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
* URL: http://localhost:3000/api/v1/chat/unread
  * Node Name: `http://localhost:3000/api/v1/chat/unread`
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
* URL: http://localhost:3000/api/v1/contact-messages/
  * Node Name: `http://localhost:3000/api/v1/contact-messages/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/3061511927319627921
  * Node Name: `http://localhost:3000/api/v1/contact-messages/3061511927319627921`
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
* URL: http://localhost:3000/api/v1/contact-messages/id/
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/contact-messages/id/9077408505562707183
  * Node Name: `http://localhost:3000/api/v1/contact-messages/id/9077408505562707183`
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
* URL: http://localhost:3000/api/v1/csr/
  * Node Name: `http://localhost:3000/api/v1/csr/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/6136495249215435707
  * Node Name: `http://localhost:3000/api/v1/csr/6136495249215435707`
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
* URL: http://localhost:3000/api/v1/csr/controlNo/
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/controlNo/9016834502062946323
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/9016834502062946323`
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
* URL: http://localhost:3000/api/v1/csr/controlNo/pdf/
  * Node Name: `http://localhost:3000/api/v1/csr/controlNo/pdf/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/csr/id
  * Node Name: `http://localhost:3000/api/v1/csr/id`
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
* URL: http://localhost:3000/api/v1/dashboard
  * Node Name: `http://localhost:3000/api/v1/dashboard`
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
* URL: http://localhost:3000/api/v1/dashboard/5970845480598314100
  * Node Name: `http://localhost:3000/api/v1/dashboard/5970845480598314100`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-counts%3Fyear=year&month=month
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-counts (month,year)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-counts%3Fyear=year+AND+1%253D1&month=month
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-counts (month,year)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-counts/
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-counts/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-tracker%3Fdate=date
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-tracker (date)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-tracker%3Fdate=date%2527%253Bcat+%252Fetc%252Fpasswd%253B%2527
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-tracker (date)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/daily-tracker/
  * Node Name: `http://localhost:3000/api/v1/dashboard/daily-tracker/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/metrics%3Fbarangay=barangay
  * Node Name: `http://localhost:3000/api/v1/dashboard/metrics (barangay)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/metrics%3Fbarangay=barangay%2527%253Bcat+%252Fetc%252Fpasswd%253B%2527
  * Node Name: `http://localhost:3000/api/v1/dashboard/metrics (barangay)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/metrics/
  * Node Name: `http://localhost:3000/api/v1/dashboard/metrics/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports`
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
* URL: http://localhost:3000/api/v1/dashboard/reports/16732136647458632
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/16732136647458632`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/mayor%3FstartDate=2026-01-01&endDate=2026-12-31
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/mayor (endDate,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/mayor%3FstartDate=2026-01-01+AND+1%253D1&endDate=2026-12-31
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/mayor (endDate,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/reports/mayor/
  * Node Name: `http://localhost:3000/api/v1/dashboard/reports/mayor/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/sla
  * Node Name: `http://localhost:3000/api/v1/dashboard/sla`
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
* URL: http://localhost:3000/api/v1/dashboard/trends%3Frange=1w
  * Node Name: `http://localhost:3000/api/v1/dashboard/trends (range)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/trends%3Frange=1w%2527%253Bcat+%252Fetc%252Fpasswd%253B%2527
  * Node Name: `http://localhost:3000/api/v1/dashboard/trends (range)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/dashboard/trends/
  * Node Name: `http://localhost:3000/api/v1/dashboard/trends/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export
  * Node Name: `http://localhost:3000/api/v1/export`
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
* URL: http://localhost:3000/api/v1/export/4746196596804293109
  * Node Name: `http://localhost:3000/api/v1/export/4746196596804293109`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/audit-logs%3Fformat=pdf&startDate=startDate&endDate=endDate
  * Node Name: `http://localhost:3000/api/v1/export/audit-logs (endDate,format,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/audit-logs%3Fformat=%253C%2521--%2523EXEC+cmd%253D%2522dir+%255C%2522--%253E&startDate=startDate&endDate=endDate
  * Node Name: `http://localhost:3000/api/v1/export/audit-logs (endDate,format,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/audit-logs/
  * Node Name: `http://localhost:3000/api/v1/export/audit-logs/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/compliance%3Fformat=pdf
  * Node Name: `http://localhost:3000/api/v1/export/compliance (format)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/compliance%3Fformat=pdf%2527%253Bcat+%252Fetc%252Fpasswd%253B%2527
  * Node Name: `http://localhost:3000/api/v1/export/compliance (format)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/compliance/
  * Node Name: `http://localhost:3000/api/v1/export/compliance/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/monthly-funds%3Fmonth=2026-08&startDate=2026-01-01&endDate=2026-12-31
  * Node Name: `http://localhost:3000/api/v1/export/monthly-funds (endDate,month,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/monthly-funds%3Fmonth=%253C%2521--%2523EXEC+cmd%253D%2522dir+%255C%2522--%253E&startDate=2026-01-01&endDate=2026-12-31
  * Node Name: `http://localhost:3000/api/v1/export/monthly-funds (endDate,month,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/monthly-funds/
  * Node Name: `http://localhost:3000/api/v1/export/monthly-funds/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/service-summary%3Fformat=pdf&startDate=startDate&endDate=endDate
  * Node Name: `http://localhost:3000/api/v1/export/service-summary (endDate,format,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/service-summary%3Fformat=%253C%2521--%2523EXEC+cmd%253D%2522dir+%255C%2522--%253E&startDate=startDate&endDate=endDate
  * Node Name: `http://localhost:3000/api/v1/export/service-summary (endDate,format,startDate)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/export/service-summary/
  * Node Name: `http://localhost:3000/api/v1/export/service-summary/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing
  * Node Name: `http://localhost:3000/api/v1/filing`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing
  * Node Name: `http://localhost:3000/api/v1/filing`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing%3FcaseId=caseId&beneficiaryId=beneficiaryId&requirementKey=requirementKey
  * Node Name: `http://localhost:3000/api/v1/filing (beneficiaryId,caseId,requirementKey)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing%3FcaseId=%253C%2521--%2523EXEC+cmd%253D%2522ls+%252F%2522--%253E&beneficiaryId=beneficiaryId&requirementKey=requirementKey
  * Node Name: `http://localhost:3000/api/v1/filing (beneficiaryId,caseId,requirementKey)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/
  * Node Name: `http://localhost:3000/api/v1/filing/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/5305229962452902815
  * Node Name: `http://localhost:3000/api/v1/filing/5305229962452902815`
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
* URL: http://localhost:3000/api/v1/filing/announcements
  * Node Name: `http://localhost:3000/api/v1/filing/announcements`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/3857695419424005300
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/3857695419424005300`
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
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/942875665774914140
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/942875665774914140`
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
* URL: http://localhost:3000/api/v1/filing/announcements/announcementId/photos/
  * Node Name: `http://localhost:3000/api/v1/filing/announcements/announcementId/photos/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case
  * Node Name: `http://localhost:3000/api/v1/filing/case`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case
  * Node Name: `http://localhost:3000/api/v1/filing/case`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/
  * Node Name: `http://localhost:3000/api/v1/filing/case/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/3133053799038493152
  * Node Name: `http://localhost:3000/api/v1/filing/case/3133053799038493152`
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
* URL: http://localhost:3000/api/v1/filing/case/caseId/
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/case/caseId/1094330472955779005
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/1094330472955779005`
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
* URL: http://localhost:3000/api/v1/filing/case/caseId/id-photo/
  * Node Name: `http://localhost:3000/api/v1/filing/case/caseId/id-photo/`
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
* URL: http://localhost:3000/api/v1/filing/id/
  * Node Name: `http://localhost:3000/api/v1/filing/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/id/6806681789057331351
  * Node Name: `http://localhost:3000/api/v1/filing/id/6806681789057331351`
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
* URL: http://localhost:3000/api/v1/filing/id/download/
  * Node Name: `http://localhost:3000/api/v1/filing/id/download/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf
  * Node Name: `http://localhost:3000/api/v1/filing/irf`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf
  * Node Name: `http://localhost:3000/api/v1/filing/irf`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/
  * Node Name: `http://localhost:3000/api/v1/filing/irf/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/8814131334574546308
  * Node Name: `http://localhost:3000/api/v1/filing/irf/8814131334574546308`
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
* URL: http://localhost:3000/api/v1/filing/irf/irfId/
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/filing/irf/irfId/1435123383304143359
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/1435123383304143359`
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
* URL: http://localhost:3000/api/v1/filing/irf/irfId/photos/
  * Node Name: `http://localhost:3000/api/v1/filing/irf/irfId/photos/`
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
* URL: http://localhost:3000/api/v1/fourps/
  * Node Name: `http://localhost:3000/api/v1/fourps/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/7143883277586167905
  * Node Name: `http://localhost:3000/api/v1/fourps/7143883277586167905`
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
* URL: http://localhost:3000/api/v1/fourps/caseId/
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/8255357872350551725
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/8255357872350551725`
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
* URL: http://localhost:3000/api/v1/fourps/caseId/compliance/
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/compliance/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/caseId/payouts
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/payouts`
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
* URL: http://localhost:3000/api/v1/fourps/compliance
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance`
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
* URL: http://localhost:3000/api/v1/fourps/compliance/2881545006415263775
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/2881545006415263775`
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
* URL: http://localhost:3000/api/v1/fourps/compliance/id/
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/compliance/id/8250021160440319825
  * Node Name: `http://localhost:3000/api/v1/fourps/compliance/id/8250021160440319825`
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
* URL: http://localhost:3000/api/v1/fourps/payouts/
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/1306303226360716944
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/1306303226360716944`
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
* URL: http://localhost:3000/api/v1/fourps/payouts/id/
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/4595040706063641173
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/4595040706063641173`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health/1119777753478988089
  * Node Name: `http://localhost:3000/api/v1/health/1119777753478988089`
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
* URL: http://localhost:3000/api/v1/intake/
  * Node Name: `http://localhost:3000/api/v1/intake/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/2969047091974419005
  * Node Name: `http://localhost:3000/api/v1/intake/2969047091974419005`
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
* URL: http://localhost:3000/api/v1/intake/confirm/
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/confirm/902493025006082494
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/902493025006082494`
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
* URL: http://localhost:3000/api/v1/inter-agency-referrals/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/76659885708157240
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/76659885708157240`
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
* URL: http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search%3Fq=q%2527%253Bcat+%252Fetc%252Fpasswd%253B%2527
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search (q)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/beneficiary-search/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case`
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
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case/5997010374843822348
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case/5997010374843822348`
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
* URL: http://localhost:3000/api/v1/inter-agency-referrals/case/caseId/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/case/caseId/`
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
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/8615587091689989092
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/8615587091689989092`
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
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/7937936990301770056
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/7937936990301770056`
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
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/8225631825470826293
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/8225631825470826293`
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
* URL: http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/person/personId/benefit-ledger/`
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
* URL: http://localhost:3000/api/v1/irf
  * Node Name: `http://localhost:3000/api/v1/irf`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf%3Fpage=1.2&limit=1.2
  * Node Name: `http://localhost:3000/api/v1/irf (limit,page)`
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
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/
  * Node Name: `http://localhost:3000/api/v1/irf/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/4589907810111580794
  * Node Name: `http://localhost:3000/api/v1/irf/4589907810111580794`
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
* URL: http://localhost:3000/api/v1/irf/by-case/
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/by-case/76900178955605795
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/76900178955605795`
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
* URL: http://localhost:3000/api/v1/irf/by-case/caseId/
  * Node Name: `http://localhost:3000/api/v1/irf/by-case/caseId/`
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
* URL: http://localhost:3000/api/v1/irf/id/
  * Node Name: `http://localhost:3000/api/v1/irf/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/3111088085294868999
  * Node Name: `http://localhost:3000/api/v1/irf/id/3111088085294868999`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-json%3FlegalBasis=legalBasis
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-json (legalBasis)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-json%3FlegalBasis=legalBasis%2527%253Bcat+%252Fetc%252Fpasswd%253B%2527
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-json (legalBasis)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-json/
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-json/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-pdf%3FlegalBasis=legalBasis&password=ZAP
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-pdf (legalBasis,password)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-pdf%3FlegalBasis=legalBasis+AND+1%253D1&password=ZAP
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-pdf (legalBasis,password)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-pdf/
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-pdf/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-wcpd%3FlegalBasis=legalBasis
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-wcpd (legalBasis)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-wcpd%3FlegalBasis=legalBasis%2527%253Bcat+%252Fetc%252Fpasswd%253B%2527
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-wcpd (legalBasis)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/export-wcpd/
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-wcpd/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/unmask-names%3FlegalBasis=legalBasis
  * Node Name: `http://localhost:3000/api/v1/irf/id/unmask-names (legalBasis)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/unmask-names%3FlegalBasis=legalBasis%2527%253Bcat+%252Fetc%252Fpasswd%253B%2527
  * Node Name: `http://localhost:3000/api/v1/irf/id/unmask-names (legalBasis)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/irf/id/unmask-names/
  * Node Name: `http://localhost:3000/api/v1/irf/id/unmask-names/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/lcr
  * Node Name: `http://localhost:3000/api/v1/lcr`
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
* URL: http://localhost:3000/api/v1/lcr/6671213557285200945
  * Node Name: `http://localhost:3000/api/v1/lcr/6671213557285200945`
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
* URL: http://localhost:3000/api/v1/minio/
  * Node Name: `http://localhost:3000/api/v1/minio/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/3789366182610508650
  * Node Name: `http://localhost:3000/api/v1/minio/3789366182610508650`
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
* URL: http://localhost:3000/api/v1/minio/signed-url/
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/8881235874800351314
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/8881235874800351314`
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
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/1366926704836533368
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/1366926704836533368`
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
* URL: http://localhost:3000/api/v1/minio/signed-url/bucket/fileName/
  * Node Name: `http://localhost:3000/api/v1/minio/signed-url/bucket/fileName/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications
  * Node Name: `http://localhost:3000/api/v1/notifications`
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
* URL: http://localhost:3000/api/v1/notifications/2835181120628262867
  * Node Name: `http://localhost:3000/api/v1/notifications/2835181120628262867`
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
* URL: http://localhost:3000/api/v1/notifications/id/
  * Node Name: `http://localhost:3000/api/v1/notifications/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/5389956952820169702
  * Node Name: `http://localhost:3000/api/v1/notifications/id/5389956952820169702`
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
* URL: http://localhost:3000/api/v1/notifications/preferences/
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/2953452774391983274
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/2953452774391983274`
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
* URL: http://localhost:3000/api/v1/notifications/recipient/
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/recipient/5642147130500223511
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/5642147130500223511`
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
* URL: http://localhost:3000/api/v1/notifications/recipient/recipientId/
  * Node Name: `http://localhost:3000/api/v1/notifications/recipient/recipientId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/unread
  * Node Name: `http://localhost:3000/api/v1/notifications/unread`
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
* URL: http://localhost:3000/api/v1/programs
  * Node Name: `http://localhost:3000/api/v1/programs`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs%3FactiveOnly=activeOnly
  * Node Name: `http://localhost:3000/api/v1/programs (activeOnly)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs%3FactiveOnly=cat+%252Fetc%252Fpasswd
  * Node Name: `http://localhost:3000/api/v1/programs (activeOnly)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/
  * Node Name: `http://localhost:3000/api/v1/programs/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/programs/2961916200355863214
  * Node Name: `http://localhost:3000/api/v1/programs/2961916200355863214`
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
* URL: http://localhost:3000/api/v1/programs/id/
  * Node Name: `http://localhost:3000/api/v1/programs/id/`
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
* URL: http://localhost:3000/api/v1/referrals
  * Node Name: `http://localhost:3000/api/v1/referrals`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals%3Fbarangay=barangay&status=status&intakePending=intakePending
  * Node Name: `http://localhost:3000/api/v1/referrals (barangay,intakePending,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals%3Fbarangay=%253C%2521--%2523EXEC+cmd%253D%2522ls+%252F%2522--%253E&status=status&intakePending=intakePending
  * Node Name: `http://localhost:3000/api/v1/referrals (barangay,intakePending,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/
  * Node Name: `http://localhost:3000/api/v1/referrals/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/6063242056173402684
  * Node Name: `http://localhost:3000/api/v1/referrals/6063242056173402684`
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
* URL: http://localhost:3000/api/v1/referrals/id/
  * Node Name: `http://localhost:3000/api/v1/referrals/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/id/7635300355146201011
  * Node Name: `http://localhost:3000/api/v1/referrals/id/7635300355146201011`
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
* URL: http://localhost:3000/api/v1/referrals/pending-count%3Fbarangay=barangay%2527%253Bcat+%252Fetc%252Fpasswd%253B%2527
  * Node Name: `http://localhost:3000/api/v1/referrals/pending-count (barangay)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/referrals/pending-count/
  * Node Name: `http://localhost:3000/api/v1/referrals/pending-count/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sla
  * Node Name: `http://localhost:3000/api/v1/sla`
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
* URL: http://localhost:3000/api/v1/sla/8561369675906781177
  * Node Name: `http://localhost:3000/api/v1/sla/8561369675906781177`
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
* URL: http://localhost:3000/api/v1/sync/
  * Node Name: `http://localhost:3000/api/v1/sync/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/7453653608518954068
  * Node Name: `http://localhost:3000/api/v1/sync/7453653608518954068`
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
* URL: http://localhost:3000/api/v1/sync/conflicts/
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/2388111733845076573
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/2388111733845076573`
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
* URL: http://localhost:3000/api/v1/sync/conflicts/id/
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/sync/conflicts/id/8155104906700323289
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/8155104906700323289`
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
* URL: http://localhost:3000/api/v1/users
  * Node Name: `http://localhost:3000/api/v1/users`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users%3Fsearch=ZAP&role=role&status=status&page=page&limit=limit
  * Node Name: `http://localhost:3000/api/v1/users (limit,page,role,search,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users%3Fsearch=https%253A%252F%252F%255C1145766686099223147.owasp.org&role=role&status=status&page=page&limit=limit
  * Node Name: `http://localhost:3000/api/v1/users (limit,page,role,search,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/
  * Node Name: `http://localhost:3000/api/v1/users/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/users/8963589091812741424
  * Node Name: `http://localhost:3000/api/v1/users/8963589091812741424`
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
* URL: http://localhost:3000/api/v1/users/id/
  * Node Name: `http://localhost:3000/api/v1/users/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
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
* URL: http://localhost:3000/api/v1/access-cards/assign/beneficiaryId
  * Node Name: `http://localhost:3000/api/v1/access-cards/assign/beneficiaryId`
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
* URL: http://localhost:3000/api/v1/access-cards/log
  * Node Name: `http://localhost:3000/api/v1/access-cards/log`
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
* URL: http://localhost:3000/api/v1/agencies/
  * Node Name: `http://localhost:3000/api/v1/agencies/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/announcements
  * Node Name: `http://localhost:3000/api/v1/announcements`
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
* URL: http://localhost:3000/api/v1/auth/change-email
  * Node Name: `http://localhost:3000/api/v1/auth/change-email`
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
* URL: http://localhost:3000/api/v1/auth/login/otp-verify/
  * Node Name: `http://localhost:3000/api/v1/auth/login/otp-verify/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/disable
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/disable`
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
* URL: http://localhost:3000/api/v1/beneficiaries/
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/beneficiaries/id/consent/revoke
  * Node Name: `http://localhost:3000/api/v1/beneficiaries/id/consent/revoke`
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
* URL: http://localhost:3000/api/v1/cases
  * Node Name: `http://localhost:3000/api/v1/cases`
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
* URL: http://localhost:3000/api/v1/cases/bulk-export/
  * Node Name: `http://localhost:3000/api/v1/cases/bulk-export/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases/caseId/interventions
  * Node Name: `http://localhost:3000/api/v1/cases/caseId/interventions`
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
* URL: http://localhost:3000/api/v1/cases/id/issue-coe
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-coe`
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
* URL: http://localhost:3000/api/v1/cases/id/issue-pcv/
  * Node Name: `http://localhost:3000/api/v1/cases/id/issue-pcv/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/chat/conversation/otherUserId/read
  * Node Name: `http://localhost:3000/api/v1/chat/conversation/otherUserId/read`
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
* URL: http://localhost:3000/api/v1/chat/send
  * Node Name: `http://localhost:3000/api/v1/chat/send`
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
* URL: http://localhost:3000/api/v1/contact-messages
  * Node Name: `http://localhost:3000/api/v1/contact-messages`
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
* URL: http://localhost:3000/api/v1/csr
  * Node Name: `http://localhost:3000/api/v1/csr`
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
* URL: http://localhost:3000/api/v1/export/certificate
  * Node Name: `http://localhost:3000/api/v1/export/certificate`
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
* URL: http://localhost:3000/api/v1/filing/upload
  * Node Name: `http://localhost:3000/api/v1/filing/upload`
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
* URL: http://localhost:3000/api/v1/fourps/caseId/generate-compliance
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/generate-compliance`
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
* URL: http://localhost:3000/api/v1/fourps/caseId/payouts/
  * Node Name: `http://localhost:3000/api/v1/fourps/caseId/payouts/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/fourps/payouts/id/notify
  * Node Name: `http://localhost:3000/api/v1/fourps/payouts/id/notify`
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
* URL: http://localhost:3000/api/v1/intake
  * Node Name: `http://localhost:3000/api/v1/intake`
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
* URL: http://localhost:3000/api/v1/intake/confirm/householdId
  * Node Name: `http://localhost:3000/api/v1/intake/confirm/householdId`
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
* URL: http://localhost:3000/api/v1/inter-agency-referrals/
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case
  * Node Name: `http://localhost:3000/api/v1/inter-agency-referrals/id/promote-to-case`
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
* URL: http://localhost:3000/api/v1/irf
  * Node Name: `http://localhost:3000/api/v1/irf`
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
* URL: http://localhost:3000/api/v1/irf/id/decrypt
  * Node Name: `http://localhost:3000/api/v1/irf/id/decrypt`
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
* URL: http://localhost:3000/api/v1/lcr/import
  * Node Name: `http://localhost:3000/api/v1/lcr/import`
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
* URL: http://localhost:3000/api/v1/minio/upload
  * Node Name: `http://localhost:3000/api/v1/minio/upload`
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
* URL: http://localhost:3000/api/v1/notifications/
  * Node Name: `http://localhost:3000/api/v1/notifications/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/id/read
  * Node Name: `http://localhost:3000/api/v1/notifications/id/read`
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
* URL: http://localhost:3000/api/v1/notifications/id/send-with-consent
  * Node Name: `http://localhost:3000/api/v1/notifications/id/send-with-consent`
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
* URL: http://localhost:3000/api/v1/notifications/read-all
  * Node Name: `http://localhost:3000/api/v1/notifications/read-all`
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
* URL: http://localhost:3000/api/v1/programs
  * Node Name: `http://localhost:3000/api/v1/programs`
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
* URL: http://localhost:3000/api/v1/referrals
  * Node Name: `http://localhost:3000/api/v1/referrals`
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
* URL: http://localhost:3000/api/v1/sla/check
  * Node Name: `http://localhost:3000/api/v1/sla/check`
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
* URL: http://localhost:3000/api/v1/sync/conflicts/id/resolve
  * Node Name: `http://localhost:3000/api/v1/sync/conflicts/id/resolve`
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
* URL: http://localhost:3000/api/v1/users/
  * Node Name: `http://localhost:3000/api/v1/users/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
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
* URL: http://localhost:3000/api/v1/notifications/preferences/bulk
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/bulk ()([])`
  * Method: `PUT`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/notifications/preferences/bulk/
  * Node Name: `http://localhost:3000/api/v1/notifications/preferences/bulk/ ()([])`
  * Method: `PUT`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``


Instances: 656

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Information Disclosure - Sensitive Information in URL ](https://www.zaproxy.org/docs/alerts/10024/)



##### Informational (Medium)

### Description

The request appeared to contain sensitive information leaked in the URL. This can violate PCI and most organizational compliance policies. You can configure the list of strings for this check to add or remove values specific to your environment.

* URL: http://localhost:3000/api/v1/irf/id/export-pdf%3FlegalBasis=legalBasis&password=ZAP
  * Node Name: `http://localhost:3000/api/v1/irf/id/export-pdf (legalBasis,password)`
  * Method: `GET`
  * Parameter: `password`
  * Attack: ``
  * Evidence: `password`
  * Other Info: `The URL contains potentially sensitive information. The following string was found via the pattern: pass
password`


Instances: 1

### Solution

Do not pass sensitive information in URIs.

### Reference



#### CWE Id: [ 598 ](https://cwe.mitre.org/data/definitions/598.html)


#### WASC Id: 13

#### Source ID: 3

### [ Non-Storable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are not storable by caching components such as proxy servers. If the response does not contain sensitive, personal or user-specific information, it may benefit from being stored and cached, to improve performance.

* URL: http://localhost:3000/api/v1/cases/disbursed/pending-intervention
  * Node Name: `http://localhost:3000/api/v1/cases/disbursed/pending-intervention`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/health/ready
  * Node Name: `http://localhost:3000/api/v1/health/ready`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/auth/mfa/enable
  * Node Name: `http://localhost:3000/api/v1/auth/mfa/enable`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/cases
  * Node Name: `http://localhost:3000/api/v1/cases`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://localhost:3000/api/v1/intake/match-check
  * Node Name: `http://localhost:3000/api/v1/intake/match-check`
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


