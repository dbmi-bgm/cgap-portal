If you would like to upload files or submit metadata to the 
CGAP portal, you will need an access key. To create a new 
access key: 

* First make sure you are logged in. 
* Click on your account in the upper right corner of the page,
 and select "Profile" from the dropdown menu. 
* On your profile, there will be a button at the bottom 
labeled "Add access key". Click this, and a popup window
containing a key and secret will pop up. Don't exit this 
window until you've recorded this information.
* For submitCGAP, our CLI submission tool, this information 
needs to be in a file named `.cgap-keys.json` in your home 
directory. This file needs to have the following format,
with an environment name and URL appropriate for your
CGAP deployment:

<br>

```
{
    "<environment>": {
        "key": "XXXXXXXX",
        "secret": "xxxxxxxxxxxxxxxx",
        "server": "<URL>"
    }
}
```
<br>
If you need more information on which environment or URL
to use, reach out to a CGAP data wrangler or send an email
to [cgap@hms-dbmi.atlassian.net](cgap@hms-dbmi.atlassian.net).
