Authenticated Access to CGAP
============================

  
Requesting An Account
---------------------

To **request a new account** or if you have **trouble** 
**logging in**, please contact us for support at 
[cgap@hms-dbmi.atlassian.net](cgap@hms-dbmi.atlassian.net).

CGAP Login Workflow
-------------------

CGAP uses the Auth0 authentication solution, which interfaces with 
a variety of different identity providers (IdP) to support institutional 
login to the CGAP portal. 

A CGAP admin creates a user account for users with their institutional 
email address. When logging into the CGAP portal using the institutional 
email, Auth0 will callback to the IdP of the supported institution to 
authenticate the user. The email will be rejected if the institutional
login is not supported by our Auth0 application. We add new institutions
on a case-by-case basis as needed by our users. It is preferred that 
standard (non-internal) users stick with authenticating through their 
respective institutions rather than bypassing it by creating an
associated Google Account.

As of writing we support the below institutional logins. If your institution
is not supported, and you are a current or planned user, please contact us so that we
can provide support for the new institution. CGAP plans to support all IdP's that
our authentication solution (Auth0) supports.
    
* Google - note that all emails can create an associated Google Account 
  and gain access to the CGAP portal. This is recommended for internal
  users only.
    
* HarvardKey - `hms.harvard.edu` emails will be redirected to HarvardKey
on login.
  
* Partners - `partners.org` emails will be redirected to Partners login.

* BCH - emails associated with Boston Children's will be redirected to 
  BCH login.
  
Once authenticated through Auth0, the authenticated email address is checked 
against our metadata database. If a user with that email exists
in our database, that user is considered "logged in", and a session token (JWT)
is created.

How to Log in
-------------

To log in, click on the icon in the upper 
right that says "Log In". A login window will pop up that will have
two options:

* Use "Sign In with Google" if your institutional login is associated
  with a Google account and you would like to authenticate through Google.
  Note that internal users who have created Google Accounts for their 
  `hms.harvard.edu` emails can choose to login via either pathway.
  
* If your account is associated with a harvard.edu, partners.org or BCH email 
  account, and you do not have an associated Google Account, you must login by 
  entering the institutional email associated with your CGAP user into the login box. 
  After filling this and clicking "Log In", you will then see another popup 
  that prompts you to sign in with your respective IdP.
