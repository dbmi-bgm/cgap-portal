from snovault.project.access_key import SnovaultProjectAccessKey

class CgapProjectAccessKey(SnovaultProjectAccessKey):
    def access_key_has_expiration_date(self):
        return True
