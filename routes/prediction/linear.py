import sys
from datetime import datetime

import numpy as np# create dummy data for training
import pandas as pd

import torch
from torch.nn import Module
from torch.autograd import Variable

class Net(Module):
    def __init__(self, inputSize, outputSize):
        super(Net, self).__init__()
        self.actifunc = torch.nn.ReLU()
        self.hidden = torch.nn.Linear(inputSize, inputSize * 2)
        self.output = torch.nn.Linear(inputSize * 2, outputSize)


    def forward(self, x):
        hidden = self.actifunc(self.hidden(x))
        out = self.actifunc(self.output(hidden))

        return out

def train(X, y, savePath, epochs=10000, learningRate=0.001):
    inputDim = X.shape[1]        # takes variable 'x'
    outputDim = y.shape[1]       # takes variable 'y'
    learningRate = learningRate
    epochs = epochs

    model = Net(inputDim, outputDim)
    ##### For GPU #######
    if torch.cuda.is_available():
        model.cuda()

    criterion = torch.nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learningRate)

    losses = [-1]

    for epoch in range(epochs):
        # Converting inputs and labels to Variable
        if torch.cuda.is_available():
            inputs = Variable(torch.from_numpy(X).cuda())
            labels = Variable(torch.from_numpy(y).cuda())
        else:
            inputs = Variable(torch.from_numpy(X))
            labels = Variable(torch.from_numpy(y))

        # Clear gradient buffers because we don't want any gradient from previous epoch to carry forward, dont want to cummulate gradients
        optimizer.zero_grad()

        # get output from the model, given the inputs
        outputs = model(inputs)

        # get loss for the predicted output
        loss = criterion(outputs, labels)

        # get gradients w.r.t to parameters
        loss.backward()

        # update parameters
        optimizer.step()

        losses.append(loss.item())
        if len(losses) > 10 and abs(losses[-1]-losses[-10]) < 10e-5:
            break

        print('epoch {}, loss {}'.format(epoch, loss.item()))

    torch.save(model, savePath)

def predict(sample, savePath):
    model  = torch.load(savePath)
    model.eval()

    with torch.no_grad(): # we don't need gradients in the testing phase
        if torch.cuda.is_available():
            predicted = model(Variable(torch.from_numpy(sample).cuda())).cpu().data.numpy()
        else:
            predicted = model(Variable(torch.from_numpy(sample))).data.numpy()

    return predicted

if __name__ == '__main__':
    if sys.argv[1] == 'train':
        df = pd.read_csv(r'./dataset.csv')
        df = df.drop(['Record'], axis=1)
        df['DateTime'] = np.vectorize(lambda x: datetime.timestamp(datetime.strptime(x, "%Y-%m-%d %H:%M:%S")))(df['DateTime'])
        df['Water'] = (20 - df['Tsoil.C.hummock']) * 60

        X = df['DateTime']
        X = np.array(X.values, dtype=np.float32)
        X = X.reshape(-1, 1)

        y = df[['Tsoil.C.hummock', 'Tair.C', 'RH.percent']].values#[i+j for (i, j) in x_values]
        y = np.array(y, dtype=np.float32)

        train(X, y, r'./save/weight1.pth', epochs=100000, learningRate=0.001)

        X = df[['Tsoil.C.hummock', 'Tair.C', 'RH.percent']]#[(i, j) for j in range(50) for i in range(50)]
        X = np.array(X.values, dtype=np.float32)
        #x_train = x_train.reshape(-1, x_train.shape[1])

        y = df['Water'].values#[i+j for (i, j) in x_values]
        y = np.array(y, dtype=np.float32)
        y = y.reshape(-1, 1)

        train(X, y, r'./save/weight2.pth', epochs=100000, learningRate=0.01)
    elif sys.argv[1] == 'eval':
        date = datetime.timestamp(datetime.strptime(sys.argv[2], "%Y-%m-%d %H:%M:%S"))
        sample = np.array(predict(np.array(date, dtype=np.float32).reshape(-1,1), r'./save/weight1.pth')[0], dtype=np.float32)
        print(predict(sample, r'./save/weight2.pth'))
