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
directory. This file needs to have the following format:

<br>

```
{
    "fourfront-cgap": {
        "key": "XXXXXXXX",
        "secret": "xxxxxxxxxxxxxxxx",
        "server": "https://cgap.hms.harvard.edu"
    }
}
```
