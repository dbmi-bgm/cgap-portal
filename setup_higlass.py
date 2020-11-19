import os
import shutil

ROOT_DIR = os.path.abspath(os.path.dirname(__file__))


if __name__ == '__main__':

    try:
        src = ROOT_DIR + '/node_modules/higlass-pileup/dist/0.higlass-pileup.min.worker.js'
        dest = ROOT_DIR + '/src/encoded/static/build/bam-fetcher-worker.js'
        shutil.copy2(src, dest)
    except shutil.Error as err:
        print(err.args[0])
